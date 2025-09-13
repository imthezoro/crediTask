import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'

// User dashboard is personalized content
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = await createClient()
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  // Get user profile with optimized query (select only needed fields)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan, usage_count, plan_valid_until, is_active')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.is_active) {
    redirect('/auth/signin?error=Account is not active')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Dashboard" />

      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Plan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold capitalize">
                {profile?.plan || 'Free'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Usage This Month</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {profile?.usage_count || 0}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Plan Valid Until</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {profile?.plan_valid_until 
                  ? new Date(profile.plan_valid_until).toLocaleDateString()
                  : 'N/A'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Install Chrome Extension</CardTitle>
            <CardDescription>
              Get started with PromptOK extension to enhance your AI prompts directly in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <ol className="list-decimal list-inside text-blue-700 space-y-2 mb-4">
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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent prompt enhancement activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent activity. Install the extension to get started!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


