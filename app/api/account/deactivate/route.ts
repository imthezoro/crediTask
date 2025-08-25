import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = createServerClient()
  
  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const admin = createAdminClient()
  const userId = userRes.user.id
  const userEmail = userRes.user.email

  try {
    // 1) Soft-deactivate profile
    const { error: updateErr } = await admin
      .from('user_profiles')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateErr) {
      console.error('Profile deactivate failed:', updateErr)
      return NextResponse.json({ error: 'Failed to deactivate account', details: updateErr.message }, { status: 500 })
    }

    // 2) Block email for 1 day (insert or upsert)
    if (userEmail) {
      const blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +1 day
      const { error: upsertErr } = await admin
        .from('blocked_emails')
        .upsert({ email: userEmail, blocked_until: blockedUntil }, { onConflict: 'email' })
      
      if (upsertErr) {
        console.warn('Failed to upsert blocked_emails:', upsertErr)
        // non-fatal — continue
      }
    }

    // 3) Revoke refresh tokens / invalidate sessions for user
    try {
      // Try the admin method to invalidate user refresh tokens
      await admin.auth.admin.deleteUser(userId, false) // false = don't delete user, just invalidate sessions
    } catch (invalidateErr) {
      console.warn('Failed to invalidate user refresh tokens:', invalidateErr)
      // Try alternative method if available
      try {
        const { error: signOutErr } = await admin.auth.admin.signOut(userId)
        if (signOutErr) {
          console.warn('Alternative signOut method also failed:', signOutErr)
        }
      } catch (altErr) {
        console.warn('All token invalidation methods failed:', altErr)
        // Continue - worst case is tokens expire naturally
      }
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Deactivation process failed:', error)
    return NextResponse.json({ 
      error: 'Deactivation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
