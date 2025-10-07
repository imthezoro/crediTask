'use client'

import { useState, useEffect } from 'react'
import { AdminApiHelper } from '@/features/admin'

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error'
  message: string
}

interface SystemHealth {
  database: HealthStatus
  api: HealthStatus
  incidents: HealthStatus
  processing: HealthStatus
  metrics: {
    dbLatency: number
    recentErrors: number
    recentSessions: number
    activeIncidents: number
  }
}

export default function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSystemHealth()
    // Refresh every 30 seconds
    const interval = setInterval(fetchSystemHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSystemHealth = async () => {
    try {
      const response = await AdminApiHelper.fetchWithAuth('/api/admin/system-health')
      if (response.ok) {
        const data = await response.json()
        setHealth(data)
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="text-center text-gray-500 py-4">
          Unable to load system health data
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Database</span>
          <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(health.database.status)}`}>
            {health.database.message}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-700">API Status</span>
          <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(health.api.status)}`}>
            {health.api.message}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Active Incidents</span>
          <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(health.incidents.status)}`}>
            {health.incidents.message}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-700">AI Processing</span>
          <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(health.processing.status)}`}>
            {health.processing.message}
          </span>
        </div>
      </div>
      
      {health.metrics && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>DB Latency: {health.metrics.dbLatency}ms</div>
            <div>Recent Sessions: {health.metrics.recentSessions}</div>
            <div>Recent Errors: {health.metrics.recentErrors}</div>
          </div>
        </div>
      )}
    </div>
  )
}
