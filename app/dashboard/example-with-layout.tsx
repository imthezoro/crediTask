'use client'

/**
 * Example: Using AdaptiveLayout in Dashboard
 * 
 * To use in your existing dashboard pages:
 * 1. Import AdaptiveLayout
 * 2. Wrap your content with it
 * 3. Pass onSignOut handler (optional)
 * 4. Pass isAdmin prop (optional)
 */

import { AdaptiveLayout } from '@/components/layouts/AdaptiveLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ExampleDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  return (
    <AdaptiveLayout 
      onSignOut={handleSignOut}
      isAdmin={false}  // Set to true for admin pages
    >
      {/* Your page content here */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="font-semibold">Card 1</h3>
            <p className="text-gray-600">Your content here</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="font-semibold">Card 2</h3>
            <p className="text-gray-600">Your content here</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="font-semibold">Card 3</h3>
            <p className="text-gray-600">Your content here</p>
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  )
}
