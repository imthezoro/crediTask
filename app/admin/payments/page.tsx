import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminTable from '@/components/AdminTable'

async function getPayments() {
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      user_profiles!inner(email)
    `)
    .order('created_at', { ascending: false })

  return payments || []
}

export default async function AdminPaymentsPage() {
  const payments = await getPayments()

  const columns = [
    { key: 'id', label: 'Payment ID' },
    { 
      key: 'user_profiles', 
      label: 'User Email',
      render: (value: any) => value?.email || 'N/A'
    },
    { 
      key: 'plan', 
      label: 'Plan',
      render: (value: string) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {value}
        </span>
      )
    },
    { 
      key: 'amount_cents', 
      label: 'Amount',
      render: (value: number, row: any) => 
        `${row.currency?.toUpperCase() || 'USD'} ${(value / 100).toFixed(2)}`
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'completed' ? 'bg-green-100 text-green-800' :
          value === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          value === 'failed' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'provider', 
      label: 'Provider',
      render: (value: string) => (
        <span className="capitalize">{value}</span>
      )
    },
    { 
      key: 'created_at', 
      label: 'Date',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <button className="text-blue-600 hover:text-blue-700 text-sm">
            View Details
          </button>
          {row.status === 'pending' && (
            <button className="text-green-600 hover:text-green-700 text-sm">
              Mark Completed
            </button>
          )}
          {row.status === 'completed' && (
            <button className="text-red-600 hover:text-red-700 text-sm">
              Refund
            </button>
          )}
        </div>
      )
    }
  ]

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount_cents, 0) / 100

  const pendingPayments = payments.filter(p => p.status === 'pending').length
  const completedPayments = payments.filter(p => p.status === 'completed').length
  const failedPayments = payments.filter(p => p.status === 'failed').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
            <nav className="space-x-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
              <Link href="/admin/users" className="text-blue-600 hover:text-blue-700">Users</Link>
              <Link href="/admin/analytics" className="text-blue-600 hover:text-blue-700">Analytics</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Payment Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Revenue</h3>
            <p className="text-2xl font-semibold text-gray-900">
              ${totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
            <p className="text-2xl font-semibold text-green-600">
              {completedPayments}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Pending</h3>
            <p className="text-2xl font-semibold text-yellow-600">
              {pendingPayments}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Failed</h3>
            <p className="text-2xl font-semibold text-red-600">
              {failedPayments}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Payments ({payments.length})</h2>
              <div className="flex space-x-3">
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Providers</option>
                  <option value="stripe">Stripe</option>
                  <option value="razorpay">Razorpay</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <AdminTable columns={columns} data={payments} />
          </div>
        </div>

        {/* Export Actions */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export & Reports</h3>
          <div className="flex space-x-4">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Export CSV
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Monthly Report
            </button>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Tax Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
