import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KPI from '@/components/KPI'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import { GuestCleanupButton } from '@/components/GuestCleanupButton'
import { ExpiredBlocksCleanupButton } from '@/components/ExpiredBlocksCleanupButton'

export const dynamic = 'force-dynamic'

async function getAdminData() {
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  if (!isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  // Get current counts
  const { count: totalUsers } = await admin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })

  const { count: promptsLast24h } = await admin
    .from('prompt_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { data: monthlyRevenue } = await admin
    .from('payments')
    .select('amount_cents')
    .eq('status', 'completed')
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  const { count: activeAlerts } = await admin
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Calculate previous period for trends
  const { count: usersLastMonth } = await admin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .lt('created_at', new Date().toISOString())

  const { count: promptsPrevious24h } = await admin
    .from('prompt_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { data: previousMonthRevenue } = await admin
    .from('payments')
    .select('amount_cents')
    .eq('status', 'completed')
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString())
    .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  // Fetch system status metrics
  let statusSuccessRate = 100
  let statusAvgResponseTime = 0
  let hasActiveIncidents = false
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/status`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      statusSuccessRate = Number(json?.metrics?.success_rate) || 100
      statusAvgResponseTime = Number(json?.metrics?.avg_response_time) || 0
      hasActiveIncidents = Array.isArray(json?.incidents) && json.incidents.some((i: { status?: string }) => i?.status === 'active')
    }
  } catch {
    // Fallbacks already set
  }

  // Weekly signups (new users in last 7 days) and trend vs previous 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const { count: newUsers7d } = await admin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo.toISOString())
  const { count: prevUsers7d } = await admin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fourteenDaysAgo.toISOString())
    .lt('created_at', sevenDaysAgo.toISOString())

  // Calculate trends
  const revenue = monthlyRevenue?.reduce((sum: number, payment: any) => sum + payment.amount_cents, 0) || 0
  const prevRevenue = previousMonthRevenue?.reduce((sum: number, payment: any) => sum + payment.amount_cents, 0) || 0
  
  const userGrowth = usersLastMonth ? Math.round(((usersLastMonth || 0) / (totalUsers || 1)) * 100) : 0
  const promptGrowth = promptsPrevious24h ? Math.round((((promptsLast24h || 0) - (promptsPrevious24h || 0)) / (promptsPrevious24h || 1)) * 100) : 0
  const revenueGrowth = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0
  const signupGrowth = prevUsers7d ? Math.round((((newUsers7d || 0) - (prevUsers7d || 0)) / (prevUsers7d || 1)) * 100) : 0

  return {
    totalUsers: totalUsers || 0,
    newUsers7d: newUsers7d || 0,
    promptsLast24h: promptsLast24h || 0,
    monthlyRevenue: revenue / 100,
    activeAlerts: activeAlerts || 0,
    userGrowth: `${userGrowth > 0 ? '+' : ''}${userGrowth}%`,
    promptGrowth: `${promptGrowth > 0 ? '+' : ''}${promptGrowth}%`,
    revenueGrowth: `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}%`,
    signupGrowth: `${signupGrowth > 0 ? '+' : ''}${signupGrowth}%`,
    statusSuccessRate,
    statusAvgResponseTime,
    hasActiveIncidents,
  }
}

export default async function AdminDashboard() {
  const { 
    newUsers7d,
    promptsLast24h, 
    monthlyRevenue, 
    activeAlerts, 
    signupGrowth,
    promptGrowth, 
    revenueGrowth,
    statusSuccessRate,
    statusAvgResponseTime,
    hasActiveIncidents,
  } = await getAdminData()

  const { user, isAdmin } = await getHeaderData()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Admin Dashboard" />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* System status strip */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              hasActiveIncidents ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                hasActiveIncidents ? 'bg-red-500' : 'bg-green-500'
              }`}></div>
              {hasActiveIncidents ? 'Service Disruption' : 'All Systems Operational'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                <div className="text-xs font-medium text-gray-500">Success Rate</div>
                <div className="text-xl font-semibold text-gray-900">{statusSuccessRate.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                <div className="text-xs font-medium text-gray-500">Avg Response Time</div>
                <div className="text-xl font-semibold text-gray-900">{statusAvgResponseTime}ms</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <KPI
            title="Weekly Signups"
            value={newUsers7d.toLocaleString()}
            change={signupGrowth}
            trend={signupGrowth.startsWith('+') ? "up" : signupGrowth.startsWith('-') ? "down" : "neutral"}
          />
          <KPI
            title="Prompts (24h)"
            value={promptsLast24h.toLocaleString()}
            change={promptGrowth}
            trend={promptGrowth.startsWith('+') ? "up" : promptGrowth.startsWith('-') ? "down" : "neutral"}
          />
          <KPI
            title="Monthly Revenue"
            value={`$${monthlyRevenue.toLocaleString()}`}
            change={revenueGrowth}
            trend={revenueGrowth.startsWith('+') ? "up" : revenueGrowth.startsWith('-') ? "down" : "neutral"}
          />
          <KPI
            title="Active Alerts"
            value={activeAlerts}
            trend={activeAlerts > 0 ? "down" : "neutral"}
          />
        </div>

        {/* Cleanup Tools Section */}
        <div className="mb-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cleanup Tools</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <GuestCleanupButton />
              <ExpiredBlocksCleanupButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
