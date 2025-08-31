import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient, isUserAdmin } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin privileges
    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { olderThanDays = 7, dryRun = false } = await request.json()

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    const cutoffIso = cutoffDate.toISOString()

    // Find guest users to cleanup
    const { data: guestUsers, error: fetchError } = await admin
      .from('user_profiles')
      .select('id, created_at, usage_count')
      .eq('is_guest', true)
      .eq('is_active', true)
      .lt('created_at', cutoffIso)

    if (fetchError) {
      console.error('Error fetching guest users:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch guest users' },
        { status: 500 }
      )
    }

    if (!guestUsers || guestUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No guest users found for cleanup',
        stats: {
          usersFound: 0,
          usersDeleted: 0,
          sessionsDeleted: 0,
          dryRun
        }
      })
    }

    const userIds = guestUsers.map(u => u.id)
    let deletedSessions = 0
    let deletedUsers = 0

    if (!dryRun) {
      // Delete prompt sessions for guest users
      const { error: sessionsError, count: sessionCount } = await admin
        .from('prompt_sessions')
        .delete({ count: 'exact' })
        .in('user_id', userIds)

      if (sessionsError) {
        console.error('Error deleting prompt sessions:', sessionsError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete prompt sessions' },
          { status: 500 }
        )
      }

      deletedSessions = sessionCount || 0

      // Soft delete guest user profiles
      const { error: profilesError, count: profileCount } = await admin
        .from('user_profiles')
        .update({ 
          is_active: false, 
          deleted_at: new Date().toISOString() 
        }, { count: 'exact' })
        .in('id', userIds)

      if (profilesError) {
        console.error('Error soft deleting user profiles:', profilesError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete user profiles' },
          { status: 500 }
        )
      }

      deletedUsers = profileCount || 0

      // Delete auth users (hard delete from Supabase Auth)
      for (const userId of userIds) {
        try {
          await admin.auth.admin.deleteUser(userId)
        } catch (error) {
          console.error(`Failed to delete auth user ${userId}:`, error)
          // Continue with other users even if one fails
        }
      }
    }

    // Log the cleanup action
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: dryRun ? 'guest_cleanup_preview' : 'guest_cleanup_executed',
      entity_type: 'user_profile',
      details: {
        olderThanDays,
        usersFound: guestUsers.length,
        usersDeleted: dryRun ? 0 : deletedUsers,
        sessionsDeleted: dryRun ? 0 : deletedSessions,
        dryRun,
        cutoffDate: cutoffIso
      },
      is_guest: false,
      performed_by: user.id,
      performed_at: new Date().toISOString(),
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 
                  request.headers.get('x-real-ip') || 
                  'unknown'
    })

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `Found ${guestUsers.length} guest users for cleanup (dry run)`
        : `Successfully cleaned up ${deletedUsers} guest users and ${deletedSessions} sessions`,
      stats: {
        usersFound: guestUsers.length,
        usersDeleted: dryRun ? 0 : deletedUsers,
        sessionsDeleted: dryRun ? 0 : deletedSessions,
        cutoffDate: cutoffIso,
        dryRun
      }
    })

  } catch (error) {
    console.error('Guest cleanup error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
