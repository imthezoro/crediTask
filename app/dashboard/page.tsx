'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      console.log('🔍 Dashboard: Starting auth check...')
      
      // First check if we have a Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('🔍 Dashboard: Current Supabase session:', {
        hasSession: !!session,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      })
      
      if (session && session.user) {
        console.log('✅ Dashboard: User authenticated via session:', session.user.id)
        // Validate session and active profile via server to enforce deactivation immediately
        try {
          const validateResp = await fetch('/api/auth/validate-session', {
            method: 'POST',
            credentials: 'include'
          })
          const validateData = await validateResp.json()
          if (!validateData.valid) {
            console.warn('❌ Dashboard: Session invalid or deactivated, redirecting.', validateData)
            // Cleanup local state and redirect
            localStorage.removeItem('sb-access-token')
            localStorage.removeItem('sb-user-data')
            router.push('/auth/signin')
            return
          }
        } catch (vErr) {
          console.error('Dashboard validate-session error:', vErr)
          router.push('/auth/signin')
          return
        }
        setUser(session.user)
        
        // Get user profile
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)

        if (profileError) {
          console.error('Profile fetch error:', profileError)
        } else if (profiles && profiles.length > 0) {
          setProfile(profiles[0])
        }
        
        setLoading(false)
        return
      }
      
      // Fallback: check localStorage token
      const storedToken = localStorage.getItem('sb-access-token')
      console.log('🔍 Dashboard: Stored token:', storedToken ? 'present' : 'missing')
      
      if (!storedToken) {
        console.log('❌ Dashboard: No session and no stored token, redirecting to signin')
        router.push('/auth/signin')
        return
      }

      // Parse token data (it's stored as JSON object now)
      let accessToken: string
      try {
        const tokenData = JSON.parse(storedToken)
        accessToken = tokenData.token
        
        // Check if token is expired
        const expiresAt = tokenData.expires_at || 0
        if (Date.now() > expiresAt) {
          console.log('❌ Dashboard: Token expired, redirecting to signin')
          localStorage.removeItem('sb-access-token')
          localStorage.removeItem('sb-user-data')
          router.push('/auth/signin')
          return
        }
      } catch (parseError) {
        // Fallback for old format (plain string)
        accessToken = storedToken
      }

      // Try to get user with stored token
      console.log('🔍 Dashboard: Trying getUser() fallback...')
      const { data: { user }, error } = await supabase.auth.getUser()
      
      console.log('🔍 Dashboard: getUser result:', { user: !!user, error: error?.message })
      
      if (error || !user) {
        console.error('❌ Dashboard: Auth error, redirecting to signin:', error)
        localStorage.removeItem('sb-access-token')
        localStorage.removeItem('sb-user-data')
        router.push('/auth/signin')
        return
      }
      
      console.log('✅ Dashboard: User authenticated successfully:', user.id)

      setUser(user)

      // Get user profile - handle case where profile doesn't exist
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)

      if (profileError) {
        console.error('Profile query error:', profileError)
        // Set default profile if query fails
        setProfile({
          id: user.id,
          plan: 'free',
          usage_count: 0,
          plan_valid_until: null
        })
      } else if (!profiles || profiles.length === 0) {
        // Profile doesn't exist, create it
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            plan: 'free',
            usage_count: 0
          })
          .select()
          .single()
        
        if (insertError) {
          console.error('Profile creation error:', insertError)
          // Use default profile if creation fails
          setProfile({
            id: user.id,
            plan: 'free',
            usage_count: 0,
            plan_valid_until: null
          })
        } else {
          setProfile(newProfile)
        }
      } else {
        setProfile(profiles[0])
      }
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth/signin')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    // Clear localStorage
    localStorage.removeItem('sb-access-token')
    localStorage.removeItem('sb-user-data')
    
    // Clear cookies
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    
    // Notify extension about logout
    window.postMessage({
      type: 'WEBSITE_LOGOUT',
      source: 'website',
      timestamp: Date.now()
    }, '*')
    
    // Redirect to signin
    router.push('/auth/signin')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to signin
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <nav className="space-x-4">
              <Link href="/billing" className="text-blue-600 hover:text-blue-700">Billing</Link>
              {profile?.is_admin && (
                <Link href="/admin" className="text-blue-600 hover:text-blue-700">Admin</Link>
              )}
              <button 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
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


