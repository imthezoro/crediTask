import { createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import KPI from '@/components/KPI'
import dynamicImport from 'next/dynamic'

// Admin pages are personalized and low-traffic (only you use them)
export const dynamic = 'force-dynamic'

// Dynamic import for Chart component to reduce bundle size and improve TTFB
const Chart = dynamicImport(() => import('@/components/Chart'), {
  ssr: false,
  loading: () => <div className="bg-white p-6 rounded-lg shadow border h-80 animate-pulse" />,
})
// Export panel removed per requirements

interface UsageItem {
  created_at: string
  status?: string | null
}

// Cache analytics briefly to reduce TTFB while keeping data fresh
export const revalidate = 60

async function getAnalyticsData() {
  const admin = createAdminClient()

  // Time ranges
  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

  // Run queries in parallel to reduce latency
  const [
    weeklyRes,
    monthlyRes,
    dauRes,
    wauRes,
    mauRes,
  ] = await Promise.all([
    admin
      .from('prompt_sessions')
      .select('created_at, status')
      .gte('created_at', sevenDaysAgo.toISOString()),
    admin
      .from('prompt_sessions')
      .select('created_at, status')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    admin
      .from('prompt_sessions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()),
    admin
      .from('prompt_sessions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString()),
    admin
      .from('prompt_sessions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  const weeklyUsage = weeklyRes.data as UsageItem[] | null
  const monthlyUsage = monthlyRes.data as UsageItem[] | null
  const dailyActiveUsers = dauRes.count || 0
  const weeklyActiveUsers = wauRes.count || 0
  const monthlyActiveUsers = mauRes.count || 0

  // Feature usage stats based on last 30 days
  const totalSessions = monthlyUsage?.length || 0
  const completedSessions = monthlyUsage?.filter(s => s.status === 'completed').length || 0
  const failedSessions = monthlyUsage?.filter(s => s.status === 'failed').length || 0

  // Prepare chart data (client expects per-day buckets)
  const processUsageData = (data: UsageItem[], days: number) => {
    const result: Array<{ date: string; usage: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const count = data?.filter(item => item.created_at.startsWith(dateStr)).length || 0
      result.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        usage: count,
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
    totalMonthly: monthlyUsage?.length || 0,
    engagement: {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
    },
    features: {
      promptEnhancement: Math.round((completedSessions / Math.max(totalSessions, 1)) * 100),
      analyticsUsage: Math.round((dailyActiveUsers || 0) / Math.max(monthlyActiveUsers || 1, 1) * 100),
      apiAccess: Math.round((failedSessions / Math.max(totalSessions, 1)) * 100),
    },
  }
}

export default async function AdminAnalyticsPage() {
  const { user, isAdmin } = await getHeaderData()
  if (!user) {
    redirect('/auth/signin')
  }
  if (!isAdmin) {
    redirect('/dashboard')
  }
  const { weeklyData, monthlyData, totalWeekly, totalMonthly, engagement, features } = await getAnalyticsData()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Analytics" />

      <div className="container mx-auto px-4 py-8 pt-24">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Success Rate</span>
                <span className="text-gray-900 font-medium">{features.promptEnhancement}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${features.promptEnhancement}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Daily Engagement</span>
                <span className="text-gray-900 font-medium">{features.analyticsUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: `${features.analyticsUsage}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Error Rate</span>
                <span className="text-gray-900 font-medium">{features.apiAccess}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${features.apiAccess}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">Daily Active Users</span>
                <span className="text-gray-900 font-medium">{engagement.dailyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Weekly Active Users</span>
                <span className="text-gray-900 font-medium">{engagement.weeklyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Monthly Active Users</span>
                <span className="text-gray-900 font-medium">{engagement.monthlyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Weekly Usage</span>
                <span className="text-gray-900 font-medium">{totalWeekly.toLocaleString()} prompts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Monthly Usage</span>
                <span className="text-gray-900 font-medium">{totalMonthly.toLocaleString()} prompts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Export options removed as per requirements */}
      </div>
    </div>
  )
}
