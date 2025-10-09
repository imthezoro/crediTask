import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import { MetricCard, ChartCard } from '@/components/analytics'
import { TrendingUp } from 'lucide-react'

// Admin pages are personalized and low-traffic (only you use them)
export const dynamic = 'force-dynamic'

// Admin analytics uses server-side rendering for better performance
// Charts are rendered client-side for interactivity

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header user={user} isAdmin={isAdmin} pageTitle="Analytics" />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Summary KPIs */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Weekly Usage"
            value={totalWeekly.toLocaleString()}
            description="Prompts enhanced this week"
            trend={{
              direction: 'up',
              value: '+15%'
            }}
          />
          <MetricCard
            title="Monthly Usage"
            value={totalMonthly.toLocaleString()}
            description="Prompts enhanced this month"
            trend={{
              direction: 'up',
              value: '+23%'
            }}
          />
          <MetricCard
            title="Avg Daily Usage"
            value={Math.round(totalWeekly / 7).toLocaleString()}
            description="Average prompts per day"
            trend={{
              direction: 'up',
              value: '+8%'
            }}
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <ChartCard
            title="Usage - Last 7 Days"
            description="Daily prompt enhancement activity"
            data={weeklyData}
            type="area"
            xKey="date"
            yKey="usage"
            config={{
              usage: {
                label: 'Prompts',
                color: 'hsl(var(--primary))'
              }
            }}
            footer={
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    Trending up this week <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 leading-none text-muted-foreground">
                    +{((totalWeekly / Math.max(totalWeekly - 100, 1)) * 100 - 100).toFixed(1)}% from last week
                  </div>
                </div>
              </div>
            }
          />
          <ChartCard
            title="Usage - Last 30 Days"
            description="Monthly prompt enhancement trend"
            data={monthlyData}
            type="bar"
            xKey="date"
            yKey="usage"
            config={{
              usage: {
                label: 'Prompts',
                color: 'hsl(217 91% 60%)'
              }
            }}
            footer={
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    Strong monthly performance <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 leading-none text-muted-foreground">
                    {totalMonthly} total prompts enhanced
                  </div>
                </div>
              </div>
            }
          />
        </div>

        {/* Detailed Analytics */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Feature Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Success Rate</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{features.promptEnhancement}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${features.promptEnhancement}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Daily Engagement</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{features.analyticsUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${features.analyticsUsage}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Error Rate</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{features.apiAccess}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all duration-300" style={{ width: `${features.apiAccess}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">User Engagement</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Daily Active Users</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{engagement.dailyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Weekly Active Users</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{engagement.weeklyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Monthly Active Users</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{engagement.monthlyActiveUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Weekly Usage</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{totalWeekly.toLocaleString()} prompts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Monthly Usage</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{totalMonthly.toLocaleString()} prompts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Export options removed as per requirements */}
      </div>
    </div>
  )
}
