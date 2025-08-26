import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Chart from '@/components/Chart'
import KPI from '@/components/KPI'
import AdminNav from '@/components/AdminNav'

async function getAnalyticsData() {
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  // Get usage data for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { data: weeklyUsage } = await supabase
    .from('prompt_sessions')
    .select('created_at')
    .gte('created_at', sevenDaysAgo.toISOString())

  // Get usage data for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const { data: monthlyUsage } = await supabase
    .from('prompt_sessions')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())

  // Process data for charts
  const processUsageData = (data: any[], days: number) => {
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const count = data?.filter(item => 
        item.created_at.startsWith(dateStr)
      ).length || 0
      
      result.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        usage: count
      })
    }
    return result
  }

  const weeklyData = processUsageData(weeklyUsage || [], 7)
  const monthlyData = processUsageData(monthlyUsage || [], 30)

  return {
    weeklyData,
    monthlyData,
    totalWeekly: weeklyUsage?.length || 0,
    totalMonthly: monthlyUsage?.length || 0
  }
}

export default async function AdminAnalyticsPage() {
  const { weeklyData, monthlyData, totalWeekly, totalMonthly } = await getAnalyticsData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <AdminNav />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Summary KPIs */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <KPI
            title="Weekly Usage"
            value={totalWeekly.toLocaleString()}
            change="+15%"
            trend="up"
          />
          <KPI
            title="Monthly Usage"
            value={totalMonthly.toLocaleString()}
            change="+23%"
            trend="up"
          />
          <KPI
            title="Avg Daily Usage"
            value={Math.round(totalWeekly / 7).toLocaleString()}
            change="+8%"
            trend="up"
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Chart
            data={weeklyData}
            type="line"
            xKey="date"
            yKey="usage"
            title="Usage - Last 7 Days"
          />
          <Chart
            data={monthlyData}
            type="bar"
            xKey="date"
            yKey="usage"
            title="Usage - Last 30 Days"
          />
        </div>

        {/* Detailed Analytics */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Features</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Prompt Enhancement</span>
                <span className="text-gray-900 font-medium">85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Analytics Dashboard</span>
                <span className="text-gray-900 font-medium">65%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">API Access</span>
                <span className="text-gray-900 font-medium">35%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '35%' }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">Daily Active Users</span>
                <span className="text-gray-900 font-medium">1,234</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Weekly Active Users</span>
                <span className="text-gray-900 font-medium">5,678</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Monthly Active Users</span>
                <span className="text-gray-900 font-medium">12,345</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Avg Session Duration</span>
                <span className="text-gray-900 font-medium">8m 32s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Retention Rate (7d)</span>
                <span className="text-gray-900 font-medium">78%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Analytics</h3>
          <div className="flex space-x-4">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Export CSV
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Generate Report
            </button>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Schedule Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
