import { createClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = await createClient()
    
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'users' // users, payments, analytics
    const format = url.searchParams.get('format') || 'csv' // csv, json

    if (type === 'users') {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      const enrichedUsers = users?.map(user => ({
        id: user.id,
        email: user.email || 'N/A',
        plan: user.plan,
        usage_count: user.usage_count,
        is_active: user.is_active,
        is_admin: user.is_admin,
        is_guest: user.is_guest,
        created_at: user.created_at,
        plan_valid_until: user.plan_valid_until
      })) || []

      if (format === 'csv') {
        const csvHeaders = 'ID,Email,Plan,Usage Count,Active,Admin,Guest,Created At,Plan Valid Until\n'
        const csvData = enrichedUsers.map(user => 
          `${user.id},${user.email},${user.plan},${user.usage_count},${user.is_active},${user.is_admin},${user.is_guest},${user.created_at},${user.plan_valid_until || ''}`
        ).join('\n')

        return new Response(csvHeaders + csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="users_export.csv"'
          }
        })
      }

      return NextResponse.json(enrichedUsers)
    }

    if (type === 'payments') {
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

      const userIds = (payments || []).map(p => p.user_id)
      let emailMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds)
        emailMap = (profiles || []).reduce((acc: Record<string, string>, p: { id: string; email?: string | null }) => {
          acc[p.id] = p.email || 'N/A'
          return acc
        }, {})
      }

      const enrichedPayments = payments?.map(payment => ({
        id: payment.id,
        user_email: emailMap[payment.user_id] || 'N/A',
        amount: payment.amount_cents / 100,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        plan: payment.plan,
        created_at: payment.created_at,
        valid_from: payment.valid_from,
        valid_to: payment.valid_to
      })) || []

      if (format === 'csv') {
        const csvHeaders = 'ID,User Email,Amount,Currency,Status,Provider,Plan,Created At,Valid From,Valid To\n'
        const csvData = enrichedPayments.map(payment => 
          `${payment.id},${payment.user_email},${payment.amount},${payment.currency},${payment.status},${payment.provider},${payment.plan},${payment.created_at},${payment.valid_from},${payment.valid_to}`
        ).join('\n')

        return new Response(csvHeaders + csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="payments_export.csv"'
          }
        })
      }

      return NextResponse.json(enrichedPayments)
    }

    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })

  } catch (error) {
    console.error('Admin export API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
