import { createServerClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminUsersTable from '@/components/AdminUsersTable'
import AdminNav from '@/components/AdminNav'

async function getUsers() {
  const supabase = createServerClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  const { data: users } = await adminClient
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const profiles = users || []

  // Build email map via Admin API
  const { data: authUsers } = await adminClient.auth.admin.listUsers()
  const emailMap = (authUsers?.users || []).reduce((acc: any, u: any) => {
    acc[u.id] = u.email
    return acc
  }, {} as Record<string, string>)

  // Enrich profiles with email field expected by AdminUsersTable
  const enriched = profiles.map((p: any) => ({
    ...p,
    email: emailMap[p.id] || 'N/A'
  }))

  return enriched
}

export default async function AdminUsersPage() {
  const users = await getUsers()

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
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Users ({users.length})</h2>
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Search users..."
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <AdminUsersTable users={users} />
          </div>
        </div>
      </div>
    </div>
  )
}
