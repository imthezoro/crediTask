import { createClient, isUserAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import AdminUsersClient from '@/components/AdminUsersClient'
import { Suspense } from 'react'

async function checkAdminAccess() {
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }
  
  // Check admin privileges
  if (!(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }
}

export default async function AdminUsersPage() {
  await checkAdminAccess()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <AdminNav />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        }>
          <AdminUsersClient />
        </Suspense>
      </div>
    </div>
  )
}
