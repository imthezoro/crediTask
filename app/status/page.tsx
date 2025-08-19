async function getStatusData() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/status`, {
      cache: 'no-store'
    })
    if (!response.ok) throw new Error('Failed to fetch status')
    return await response.json()
  } catch (error) {
    return {
      incidents: [],
      metrics: {
        prompts_last_24h: 0,
        success_rate: 100,
        avg_response_time: 0
      }
    }
  }
}

export default async function StatusPage() {
  const { incidents, metrics } = await getStatusData()
  const hasActiveIncidents = incidents.some((i: any) => i.status === 'active')

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">System Status</h1>
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
            hasActiveIncidents 
              ? 'bg-red-100 text-red-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              hasActiveIncidents ? 'bg-red-500' : 'bg-green-500'
            }`}></div>
            {hasActiveIncidents ? 'Service Disruption' : 'All Systems Operational'}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Prompts (24h)</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.prompts_last_24h.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Success Rate</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.success_rate.toFixed(1)}%
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Response Time</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.avg_response_time}ms
            </p>
          </div>
        </div>

        {/* Current Incidents */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Incidents</h2>
          {incidents.filter((i: any) => i.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <p>No active incidents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.filter((i: any) => i.status === 'active').map((incident: any) => (
                <div key={incident.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></div>
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900">{incident.title}</h3>
                      <p className="text-red-700 text-sm mt-1">{incident.description}</p>
                      <p className="text-red-600 text-xs mt-2">
                        Started: {new Date(incident.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Incidents</h2>
          {incidents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent incidents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.slice(0, 5).map((incident: any) => (
                <div key={incident.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className={`w-2 h-2 rounded-full mt-2 mr-3 ${
                      incident.status === 'resolved' ? 'bg-green-500' : 
                      incident.status === 'investigating' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">{incident.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          incident.status === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-1">{incident.description}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        {new Date(incident.created_at).toLocaleString()}
                        {incident.resolved_at && (
                          <span> - Resolved: {new Date(incident.resolved_at).toLocaleString()}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
