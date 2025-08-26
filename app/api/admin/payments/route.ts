import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = createServerClient()
    
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const provider = url.searchParams.get('provider')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
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

    // Get user emails for payments
    const userIds = payments?.map(p => p.user_id) || []
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    
    const emailMap = authUsers.users.reduce((acc: any, user) => {
      acc[user.id] = user.email
      return acc
    }, {})

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
