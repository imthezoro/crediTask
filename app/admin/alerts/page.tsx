import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminTable from '@/components/AdminTable'

async function getIncidents() {
  const cookieStore = cookies()
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })

  return incidents || []
}

export default async function AdminAlertsPage() {
  const incidents = await getIncidents()

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'resolved' ? 'bg-green-100 text-green-800' :
          value === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'severity', 
      label: 'Severity',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'critical' ? 'bg-red-100 text-red-800' :
          value === 'high' ? 'bg-orange-100 text-orange-800' :
          value === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'created_at', 
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleString()
    },
    { 
      key: 'resolved_at', 
      label: 'Resolved',
      render: (value: string) => value ? new Date(value).toLocaleString() : 'N/A'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <button className="text-blue-600 hover:text-blue-700 text-sm">
            View
          </button>
          {row.status === 'active' && (
            <>
              <button className="text-yellow-600 hover:text-yellow-700 text-sm">
                Update
              </button>
              <button className="text-green-600 hover:text-green-700 text-sm">
                Resolve
              </button>
            </>
          )}
        </div>
      )
    }
  ]

  const activeIncidents = incidents.filter(i => i.status === 'active').length
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">System Alerts</h1>
            <nav className="space-x-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
              <Link href="/admin/users" className="text-blue-600 hover:text-blue-700">Users</Link>
              <Link href="/admin/analytics" className="text-blue-600 hover:text-blue-700">Analytics</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Alert Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Active Incidents</h3>
            <p className="text-2xl font-semibold text-red-600">
              {activeIncidents}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Resolved Today</h3>
            <p className="text-2xl font-semibold text-green-600">
              {resolvedIncidents}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Critical</h3>
            <p className="text-2xl font-semibold text-orange-600">
              {criticalIncidents}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Uptime</h3>
            <p className="text-2xl font-semibold text-green-600">
              99.9%
            </p>
          </div>
        </div>

        {/* Create New Incident */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Manual Incident</h2>
          <form className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Brief incident description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Detailed incident description and impact"
              ></textarea>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Create Incident
              </button>
            </div>
          </form>
        </div>

        {/* Incidents Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">All Incidents ({incidents.length})</h2>
              <div className="flex space-x-3">
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <AdminTable columns={columns} data={incidents} />
          </div>
        </div>

        {/* System Health Monitoring */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Services Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">API Gateway</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Database</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">AI Processing</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Degraded</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Extension Service</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Operational</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Alert Rules</h4>
              <div className="space-y-2 text-sm">
                <div className="text-gray-600">• High error rate (&gt;5%)</div>
                <div className="text-gray-600">• Response time &gt;2s</div>
                <div className="text-gray-600">• Database connection issues</div>
                <div className="text-gray-600">• API rate limit exceeded</div>
                <div className="text-gray-600">• Disk usage &gt;90%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
