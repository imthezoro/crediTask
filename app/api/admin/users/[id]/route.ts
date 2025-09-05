import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { REACTIVATION_BLOCK } from '@/lib/auth-constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = params.id

    // Get user profile
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('id, email, plan, usage_count, is_active, is_guest, is_admin, created_at, updated_at, plan_valid_until')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prefer email from user_profiles; fallback to Admin API if missing
    let resolvedEmail: string | null = profile.email || null
    if (!resolvedEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      resolvedEmail = authUser.user?.email || null
    }

    // Get user's prompt sessions
    const { data: sessions } = await admin
      .from('prompt_sessions')
      .select('id, original_prompt, enhanced_prompt, site, created_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get user's payments
    const { data: payments } = await admin
      .from('payments')
      .select('id, provider, amount_cents, currency, status, plan, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      profile: {
        ...profile,
        email: resolvedEmail || 'N/A'
      },
      sessions: sessions || [],
      payments: payments || []
    })

  } catch (error) {
    console.error('Admin user detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = params.id
    const body = await request.json()
    const { action, ...updateData } = body

    if (action === 'reset-usage') {
      const { error: updateError } = await admin
        .from('user_profiles')
        .update({ usage_count: 0 })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Usage reset successfully' })
    }

    if (action === 'suspend') {
      const { error: updateError } = await admin
        .from('user_profiles')
        .update({ 
          is_active: false,
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Add to blocked emails using email from user_profiles (fallback to auth if missing)
      let emailToBlock: string | null = null
      const { data: userProfile } = await admin
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single()
      emailToBlock = typeof userProfile?.email === 'string' ? userProfile.email.toLowerCase() : null
      if (!emailToBlock) {
        const { data: authUser } = await admin.auth.admin.getUserById(userId)
        emailToBlock = authUser.user?.email?.toLowerCase() || null
      }
      if (emailToBlock) {
        const blockedUntil = new Date()
        blockedUntil.setDate(blockedUntil.getDate() + REACTIVATION_BLOCK.suspensionDays)

        await admin
          .from('blocked_emails')
          .upsert({
            email: emailToBlock,
            blocked_until: blockedUntil.toISOString()
          }, { onConflict: 'email' })
      }

      return NextResponse.json({ message: 'User suspended successfully' })
    }

    if (action === 'reactivate') {
      const { error: updateError } = await admin
        .from('user_profiles')
        .update({ 
          is_active: true,
          deleted_at: null
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Remove from blocked emails - prefer user_profiles.email
      let emailToUnblock: string | null = null
      const { data: userProfile2 } = await admin
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single()
      emailToUnblock = typeof userProfile2?.email === 'string' ? userProfile2.email.toLowerCase() : null
      if (!emailToUnblock) {
        const { data: authUser } = await admin.auth.admin.getUserById(userId)
        emailToUnblock = authUser.user?.email?.toLowerCase() || null
      }
      if (emailToUnblock) {
        await admin
          .from('blocked_emails')
          .delete()
          .eq('email', emailToUnblock)
      }

      return NextResponse.json({ message: 'User reactivated successfully' })
    }

    // General profile update
    const allowedFields = ['plan', 'plan_valid_until', 'is_admin']
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((acc: Record<string, string>, key) => {
        acc[key] = updateData[key]
        return acc
      }, {})

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { error: updateError } = await admin
      .from('user_profiles')
      .update(filteredData)
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'User updated successfully' })

  } catch (error) {
    console.error('Admin user update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
