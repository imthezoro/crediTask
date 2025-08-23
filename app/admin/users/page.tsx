import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminTable from '@/components/AdminTable'

async function getUsers() {
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return users || []
}

export default async function AdminUsersPage() {
  const users = await getUsers()

  const columns = [
    { key: 'id', label: 'ID' },
    { 
      key: 'email', 
      label: 'Email',
      render: (value: string) => value && value.includes('@promptok.guest') ? 'Guest' : value
    },
    { 
      key: 'plan', 
      label: 'Plan',
      render: (value: string) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {value || 'free'}
        </span>
      )
    },
    { key: 'usage_count', label: 'Usage Count' },
    { 
      key: 'plan_valid_until', 
      label: 'Plan Valid Until',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A'
    },
    { 
      key: 'created_at', 
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <button className="text-blue-600 hover:text-blue-700 text-sm">
            Edit Plan
          </button>
          <button className="text-green-600 hover:text-green-700 text-sm">
            Reset Usage
          </button>
          <button className="text-red-600 hover:text-red-700 text-sm">
            Suspend
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <nav className="space-x-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
              <Link href="/admin/payments" className="text-blue-600 hover:text-blue-700">Payments</Link>
              <Link href="/admin/analytics" className="text-blue-600 hover:text-blue-700">Analytics</Link>
            </nav>
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
            <AdminTable columns={columns} data={users} />
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Actions</h3>
          <div className="flex space-x-4">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Export Users
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Send Notification
            </button>
            <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors">
              Reset Usage (All)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
