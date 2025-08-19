import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile }
}

export default async function Dashboard() {
  const { user, profile } = await getUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <nav className="space-x-4">
              <Link href="/settings" className="text-blue-600 hover:text-blue-700">Settings</Link>
              <Link href="/billing" className="text-blue-600 hover:text-blue-700">Billing</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Current Plan</h3>
            <p className="text-2xl font-semibold text-gray-900 capitalize">
              {profile?.plan || 'Free'}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Usage This Month</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {profile?.usage_count || 0}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Plan Valid Until</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {profile?.plan_valid_until 
                ? new Date(profile.plan_valid_until).toLocaleDateString()
                : 'N/A'
              }
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Install Chrome Extension</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Get Started with PromptOK Extension</h3>
            <p className="text-blue-700 mb-4">
              Install our Chrome extension to start enhancing your AI prompts directly in your browser.
            </p>
            <ol className="list-decimal list-inside text-blue-700 space-y-2 mb-4">
              <li>Download the extension from the Chrome Web Store</li>
              <li>Pin the extension to your toolbar</li>
              <li>Sign in with your PromptOK account</li>
              <li>Start enhancing prompts on any AI platform</li>
            </ol>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Install Extension
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-gray-500 text-center py-8">
            <p>No recent activity. Install the extension to get started!</p>
          </div>
        </div>
      </div>
    </div>
  )
}


