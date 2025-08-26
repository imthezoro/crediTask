import { createServerClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = createServerClient()
    const admin = createAdminClient()
    
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get total users
    const { count: totalUsers } = await admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Get prompts in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { count: promptsLast24h } = await admin
      .from('prompt_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    // Get monthly revenue
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const { data: payments } = await admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'completed')
      .gte('created_at', monthStart.toISOString())

    const monthlyRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0

    // Get active alerts
    const { count: activeAlerts } = await admin
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get user growth (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { count: newUsers } = await admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Get plan distribution
    const { data: planDistribution } = await admin
      .from('user_profiles')
      .select('plan')

    const plans = planDistribution?.reduce((acc: any, user) => {
      const plan = user.plan || 'free'
      acc[plan] = (acc[plan] || 0) + 1
      return acc
    }, {}) || {}

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      promptsLast24h: promptsLast24h || 0,
      monthlyRevenue: monthlyRevenue / 100,
      activeAlerts: activeAlerts || 0,
      newUsers: newUsers || 0,
      planDistribution: plans
    })

  } catch (error) {
    console.error('Admin metrics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
