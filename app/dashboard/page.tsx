import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import { MetricCard } from '@/components/analytics'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = await createClient()
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan, usage_count, plan_valid_until, is_active')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.is_active) {
    redirect('/auth/signin?error=Account is not active')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header user={user} isAdmin={isAdmin} pageTitle="Dashboard" />

      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Current Plan"
            value={profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'}
            description="Your subscription tier"
          />
          
          <MetricCard
            title="Usage This Month"
            value={profile?.usage_count || 0}
            description="Prompt enhancements used"
            trend={{
              direction: 'up',
              value: '+12%'
            }}
          />
          
          <MetricCard
            title="Plan Valid Until"
            value={
              profile?.plan_valid_until 
                ? new Date(profile.plan_valid_until).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : '-'
            }
            description="Renewal date"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Install Chrome Extension</CardTitle>
            <CardDescription>
              Get started with PromptOK extension to enhance your AI prompts directly in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-2 mb-4">
                <li>Click the button below to download the ZIP file.</li>
                <li>Extract the downloaded ZIP to a folder on your computer.</li>
                <li>Open Chrome and go to <span className="font-mono">chrome://extensions</span>.</li>
                <li>Enable <span className="font-semibold">Developer mode</span> (top-right toggle).</li>
                <li>Click <span className="font-semibold">Load unpacked</span> and select the extracted folder.</li>
                <li>Pin the PromptOK extension to your toolbar for quick access.</li>
                <li>Open the extension and sign in with your prompt-ok.vercel.app account.</li>
              </ol>
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <a
                  href="https://prompt-ok.vercel.app/extension/extension.zip"
                  download="promptok-extension.zip"
                >
                  Install Extension
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
