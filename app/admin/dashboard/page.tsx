import AdminNav from '@/components/AdminNav'
import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import KPI from '@/components/KPI'

async function getAdminData() {
  const supabase = await createClient()
  const admin = createAdminClient()
  
  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }
  
  // Check admin privileges
  if (!(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

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
  const revenue = monthlyRevenue?.reduce((sum, payment) => sum + payment.amount_cents, 0) || 0
  const prevRevenue = previousMonthRevenue?.reduce((sum, payment) => sum + payment.amount_cents, 0) || 0
  
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
    signupGrowth: `${signupGrowth > 0 ? '+' : ''}${signupGrowth}%`
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
    revenueGrowth
  } = await getAdminData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <AdminNav />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
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
      </div>
    </div>
  )
}
