import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import KPI from '@/components/KPI'

async function getAdminData() {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  
  if (!accessToken) {
    redirect('/auth/signin')
  }

  const supabase = createServerClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      redirect('/dashboard')
    }
  } catch (error) {
    redirect('/auth/signin')
  }

  // Get KPI data
  const { data: totalUsers } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact' })

  const { data: promptsLast24h } = await supabase
    .from('prompt_sessions')
    .select('id', { count: 'exact' })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { data: monthlyRevenue } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('status', 'completed')
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  const { data: activeAlerts } = await supabase
    .from('incidents')
    .select('id', { count: 'exact' })
    .eq('status', 'active')

  const revenue = monthlyRevenue?.reduce((sum, payment) => sum + payment.amount_cents, 0) || 0

  return {
    totalUsers: totalUsers?.length || 0,
    promptsLast24h: promptsLast24h?.length || 0,
    monthlyRevenue: revenue / 100,
    activeAlerts: activeAlerts?.length || 0
  }
}

export default async function AdminDashboard() {
  const { totalUsers, promptsLast24h, monthlyRevenue, activeAlerts } = await getAdminData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <nav className="space-x-4">
              <Link href="/admin/users" className="text-blue-600 hover:text-blue-700">Users</Link>
              <Link href="/admin/payments" className="text-blue-600 hover:text-blue-700">Payments</Link>
              <Link href="/admin/analytics" className="text-blue-600 hover:text-blue-700">Analytics</Link>
              <Link href="/admin/alerts" className="text-blue-600 hover:text-blue-700">Alerts</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <KPI
            title="Total Users"
            value={totalUsers.toLocaleString()}
            change="+12%"
            trend="up"
          />
          <KPI
            title="Prompts (24h)"
            value={promptsLast24h.toLocaleString()}
            change="+5%"
            trend="up"
          />
          <KPI
            title="Monthly Revenue"
            value={`$${monthlyRevenue.toLocaleString()}`}
            change="+18%"
            trend="up"
          />
          <KPI
            title="Active Alerts"
            value={activeAlerts}
            trend={activeAlerts > 0 ? "down" : "neutral"}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/admin/users"
                className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-blue-900">Manage Users</div>
                <div className="text-sm text-blue-700">View and manage user accounts</div>
              </Link>
              <Link
                href="/admin/analytics"
                className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-green-900">View Analytics</div>
                <div className="text-sm text-green-700">Check usage trends and metrics</div>
              </Link>
              <Link
                href="/admin/alerts"
                className="block w-full text-left px-4 py-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-yellow-900">System Alerts</div>
                <div className="text-sm text-yellow-700">Monitor system health and incidents</div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">API Status</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Database</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Extension Service</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">AI Processing</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Normal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span className="text-gray-600">New user registration: user@example.com</span>
              <span className="ml-auto text-gray-400">2 minutes ago</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-600">Payment processed: $19.00 (Pro plan)</span>
              <span className="ml-auto text-gray-400">15 minutes ago</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
              <span className="text-gray-600">High usage detected: 1,000+ prompts in last hour</span>
              <span className="ml-auto text-gray-400">1 hour ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
