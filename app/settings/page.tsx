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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile }
}

export default async function SettingsPage() {
  const { user, profile } = await getUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <nav className="space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
              <Link href="/billing" className="text-blue-600 hover:text-blue-700">Billing</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
            <form className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              
              <div>
                <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Plan
                </label>
                <input
                  type="text"
                  id="plan"
                  value={profile?.plan || 'Free'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 capitalize"
                />
              </div>

              <div>
                <label htmlFor="usage" className="block text-sm font-medium text-gray-700 mb-1">
                  Usage Count
                </label>
                <input
                  type="number"
                  id="usage"
                  value={profile?.usage_count || 0}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div className="pt-4">
                <Link
                  href="/billing"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Manage Plan
                </Link>
              </div>
            </form>
          </div>

          {/* Account Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Actions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Reset Password</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Send a password reset email to your registered email address.
                </p>
                <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  Reset Password
                </button>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Permanently delete your account and all associated data.
                </p>
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>

          {/* API Access */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">API Access</h2>
            <p className="text-gray-600 mb-4">
              API access is available for Pro and Enterprise plans.
            </p>
            {profile?.plan === 'free' ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  Upgrade to Pro or Enterprise to access the API.
                </p>
                <Link
                  href="/billing"
                  className="inline-block mt-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Upgrade Plan →
                </Link>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 mb-2">API Key:</p>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                  pk_live_xxxxxxxxxxxxxxxx
                </code>
                <button className="ml-2 text-blue-600 hover:text-blue-700 text-sm">
                  Regenerate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
