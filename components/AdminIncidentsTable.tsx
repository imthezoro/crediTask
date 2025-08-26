'use client'

import AdminTable from '@/components/AdminTable'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminIncidentsTableProps {
  incidents: any[]
}

export default function AdminIncidentsTable({ incidents }: AdminIncidentsTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
  const makeApiCall = async (incidentId: string, action: string, data?: any) => {
    setLoading(incidentId)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch(`/api/admin/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...data })
      })

      if (!response.ok) {
        throw new Error('Action failed')
      }

      const result = await response.json()
      alert(result.message || 'Action completed successfully')
      router.refresh()
    } catch (error) {
      alert('Action failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleView = async (row: any) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch(`/api/admin/incidents/${row.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const incident = await response.json()
        alert(`Incident Details:\nTitle: ${incident.title}\nDescription: ${incident.description || 'N/A'}\nStatus: ${incident.status}\nSeverity: ${incident.severity}\nCreated: ${new Date(incident.created_at).toLocaleString()}\nResolved: ${incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : 'N/A'}`)
      }
    } catch (error) {
      alert('Failed to load incident details')
    }
  }
  
  const handleUpdate = (row: any) => {
    const newStatus = prompt('Update status (active, investigating, resolved):', row.status)
    if (newStatus && ['active', 'investigating', 'resolved'].includes(newStatus)) {
      makeApiCall(row.id, 'update', { status: newStatus })
    }
  }
  
  const handleResolve = (row: any) => {
    if (confirm('Mark this incident as resolved?')) {
      makeApiCall(row.id, 'resolve')
    }
  }
  
  const handleReopen = (row: any) => {
    if (confirm('Reopen this incident?')) {
      makeApiCall(row.id, 'reopen')
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'resolved'
              ? 'bg-green-100 text-green-800'
              : value === 'investigating'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {value}
        </span>
      )
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value: string) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'critical'
              ? 'bg-red-100 text-red-800'
              : value === 'high'
              ? 'bg-orange-100 text-orange-800'
              : value === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {value}
        </span>
      )
    },
    { key: 'created_at', label: 'Created', render: (v: string) => new Date(v).toLocaleString() },
    { key: 'resolved_at', label: 'Resolved', render: (v: string) => (v ? new Date(v).toLocaleString() : 'N/A') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => handleView(row)} 
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            View
          </button>
          {row.status === 'active' && (
            <>
              <button 
                onClick={() => handleUpdate(row)} 
                disabled={loading === row.id}
                className="text-yellow-600 hover:text-yellow-700 text-sm disabled:opacity-50"
              >
                Update
              </button>
              <button 
                onClick={() => handleResolve(row)} 
                disabled={loading === row.id}
                className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
              >
                Resolve
              </button>
            </>
          )}
          {row.status === 'resolved' && (
            <button 
              onClick={() => handleReopen(row)} 
              disabled={loading === row.id}
              className="text-orange-600 hover:text-orange-700 text-sm disabled:opacity-50"
            >
              Reopen
            </button>
          )}
        </div>
      )
    }
  ]

  return <AdminTable columns={columns} data={incidents} />
}
