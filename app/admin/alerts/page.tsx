import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import AdminIncidentsTable from '@/components/AdminIncidentsTable'
import CreateIncidentForm from '@/components/CreateIncidentForm'

// Admin pages are personalized and low-traffic (only you use them)
export const dynamic = 'force-dynamic'

async function getIncidents() {
  const supabase = await createClient()
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25)

  return incidents || []
}

export default async function AdminAlerts() {
  const { user, isAdmin } = await getHeaderData()
  if (!user) {
    redirect('/auth/signin')
  }
  if (!isAdmin) {
    redirect('/dashboard')
  }
  const incidents = await getIncidents()

  const activeIncidents = incidents.filter(i => i.status === 'active').length
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="System Alerts" />

      <div className="container mx-auto px-4 py-8 pt-24">
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
        <CreateIncidentForm />

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
              <AdminIncidentsTable incidents={incidents} />
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
