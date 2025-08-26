'use client'

import AdminTable from '@/components/AdminTable'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminIncidentsTableProps {
  incidents: any[]
}

export default function AdminIncidentsTable({ incidents }: AdminIncidentsTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | { label: string; onConfirm: () => void }>(null)
  const [updateDialog, setUpdateDialog] = useState<null | { id: string; status: string }>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const formatDate = (s: string) => {
    if (!s) return 'N/A'
    try {
      return new Date(s).toISOString().slice(0, 16).replace('T', ' ') // YYYY-MM-DD HH:mm (UTC)
    } catch {
      return 'N/A'
    }
  }
  
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
      showToast(result.message || 'Action completed successfully', 'success')
      router.refresh()
    } catch (error) {
      showToast('Action failed. Please try again.', 'error')
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
        showToast('Loaded incident details', 'success')
        setUpdateDialog(null)
        // Optionally we could show a small inline detail panel; keeping toast for brevity
      }
    } catch (error) {
      showToast('Failed to load incident details', 'error')
    }
  }
  
  const handleUpdate = (row: any) => {
    setUpdateDialog({ id: row.id, status: row.status })
  }
  
  const handleResolve = (row: any) => {
    setConfirmAction({ label: 'Mark this incident as resolved?', onConfirm: () => makeApiCall(row.id, 'resolve') })
  }
  
  const handleReopen = (row: any) => {
    setConfirmAction({ label: 'Reopen this incident?', onConfirm: () => makeApiCall(row.id, 'reopen') })
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
    { key: 'created_at', label: 'Created', render: (v: string) => formatDate(v) },
    { key: 'resolved_at', label: 'Resolved', render: (v: string) => (v ? formatDate(v) : 'N/A') },
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

  return (
    <div className="relative">
      <AdminTable columns={columns} data={incidents} />

      {loading && (
        <div className="pointer-events-none fixed inset-0 flex items-end justify-end p-4 z-40">
          <div className="bg-white/80 backdrop-blur px-3 py-2 rounded shadow text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-gray-800" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Processing...
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow p-4 w-80">
            <div className="text-sm text-gray-800 mb-4">{confirmAction.label}</div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className="px-3 py-1 bg-gray-900 text-white rounded text-sm"
                onClick={() => { const fn = confirmAction.onConfirm; setConfirmAction(null); fn(); }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Update status dialog */}
      {updateDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow p-4 w-96">
            <div className="text-sm font-medium text-gray-900 mb-2">Update Incident Status</div>
            <div className="flex items-center gap-2 mb-4">
              <label className="text-sm text-gray-700">Status</label>
              <select
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                value={updateDialog.status}
                onChange={(e) => setUpdateDialog({ ...updateDialog, status: e.target.value })}
              >
                <option value="active">active</option>
                <option value="investigating">investigating</option>
                <option value="resolved">resolved</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => setUpdateDialog(null)}>Cancel</button>
              <button
                className="px-3 py-1 bg-gray-900 text-white rounded text-sm"
                onClick={() => { const { id, status } = updateDialog; setUpdateDialog(null); makeApiCall(id, 'update', { status }); }}
              >Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
