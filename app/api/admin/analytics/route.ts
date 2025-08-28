import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || '30' // days
    const type = url.searchParams.get('type') || 'usage' // usage, revenue, users

    const daysAgo = parseInt(period)
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    if (type === 'usage') {
      // Get daily usage data
      const { data: sessions } = await admin
        .from('prompt_sessions')
        .select('created_at, status, response_time_ms')
        .gte('created_at', startDate.toISOString())

      // Process data by day
      const dailyData = []
      for (let i = daysAgo - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayData = sessions?.filter(s => s.created_at.startsWith(dateStr)) || []
        const successful = dayData.filter(s => s.status === 'completed').length
        const failed = dayData.filter(s => s.status === 'failed').length
        const avgResponseTime = dayData.length > 0 
          ? dayData.reduce((sum, s) => sum + (s.response_time_ms || 0), 0) / dayData.length 
          : 0

        dailyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          usage: dayData.length,
          successful,
          failed,
          avgResponseTime: Math.round(avgResponseTime)
        })
      }

      return NextResponse.json({
        type: 'usage',
        period: daysAgo,
        data: dailyData,
        total: sessions?.length || 0
      })
    }

    if (type === 'revenue') {
      // Get daily revenue data
      const { data: payments } = await admin
        .from('payments')
        .select('created_at, amount_cents, status, currency')
        .gte('created_at', startDate.toISOString())

      // Process data by day
      const dailyData = []
      for (let i = daysAgo - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayPayments = payments?.filter(p => p.created_at.startsWith(dateStr)) || []
        const completedPayments = dayPayments.filter(p => p.status === 'completed')
        const revenue = completedPayments.reduce((sum, p) => sum + p.amount_cents, 0) / 100

        dailyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue,
          transactions: dayPayments.length,
          completed: completedPayments.length
        })
      }

      const totalRevenue = payments?.filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount_cents, 0) || 0

      return NextResponse.json({
        type: 'revenue',
        period: daysAgo,
        data: dailyData,
        total: totalRevenue / 100
      })
    }

    if (type === 'users') {
      // Get daily user registration data
      const { data: users } = await admin
        .from('user_profiles')
        .select('created_at, plan, is_guest')
        .gte('created_at', startDate.toISOString())

      // Process data by day
      const dailyData = []
      for (let i = daysAgo - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayUsers = users?.filter(u => u.created_at.startsWith(dateStr)) || []
        const guestUsers = dayUsers.filter(u => u.is_guest).length
        const regularUsers = dayUsers.filter(u => !u.is_guest).length

        dailyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          newUsers: dayUsers.length,
          guestUsers,
          regularUsers
        })
      }

      return NextResponse.json({
        type: 'users',
        period: daysAgo,
        data: dailyData,
        total: users?.length || 0
      })
    }

    return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })

  } catch (error) {
    console.error('Admin analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

