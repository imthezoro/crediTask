import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    
    // Check if email is currently blocked
    const { data, error } = await admin
      .from('blocked_emails')
      .select('blocked_until')
      .eq('email', email)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (normal case)
      console.error('blocked_emails check error:', error)
      return NextResponse.json({ error: 'Server error checking email status' }, { status: 500 })
    }

    // If we found a blocked email record, check if it's still active
    if (data && new Date(data.blocked_until) > new Date()) {
      return NextResponse.json({
        blocked: true,
        blocked_until: data.blocked_until,
        message: `This email was recently used for a deactivated account and can't be reused until ${new Date(data.blocked_until).toLocaleString()}`
      }, { status: 403 })
    }

    // Email is not blocked or block has expired
    return NextResponse.json({ blocked: false })
    
  } catch (error) {
    console.error('Pre-signup check failed:', error)
    return NextResponse.json({ 
      error: 'Failed to check email eligibility',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
