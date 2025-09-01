import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const provider = url.searchParams.get('provider')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = admin
      .from('payments')
      .select(`
        *,
        user_profiles!inner(id)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (provider && provider !== 'all') {
      query = query.eq('provider', provider)
    }

    const { data: payments, error: paymentsError } = await query

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 })
    }

    // Build email map from user_profiles instead of listing all auth users
    const userIds = payments?.map(p => p.user_id) || []
    let emailMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from('user_profiles')
        .select('id, email')
        .in('id', userIds)
      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }
      emailMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.email || 'N/A'
        return acc
      }, {})
    }

    // Enrich payments with user emails
    const enrichedPayments = payments?.map(payment => ({
      ...payment,
      user_email: emailMap[payment.user_id] || 'N/A'
    })) || []

    return NextResponse.json({
      payments: enrichedPayments,
      total: enrichedPayments.length
    })

  } catch (error) {
    console.error('Admin payments API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
