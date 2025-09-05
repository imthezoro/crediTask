import { redirect } from 'next/navigation'
import AdminUsersClient from '@/components/AdminUsersClient'
import { Suspense } from 'react'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'

// Admin pages are personalized and low-traffic (only you use them)
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  // Check admin privileges
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="User Management" />

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
