'use client'

import AdminTable from '@/components/AdminTable'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface IncidentRow {
  id: string
  title?: string | null
  status: string
  severity?: string | null
  created_at?: string | null
  resolved_at?: string | null
  [key: string]: unknown
}

interface AdminIncidentsTableProps {
  incidents: IncidentRow[]
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
  
  const makeApiCall = async (incidentId: string, action: string, data?: Record<string, unknown>) => {
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
    } catch {
      showToast('Action failed. Please try again.', 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleView = async (row: IncidentRow) => {
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
        await response.json()
        showToast('Loaded incident details', 'success')
        setUpdateDialog(null)
        // Optionally we could show a small inline detail panel; keeping toast for brevity
      }
    } catch {
      showToast('Failed to load incident details', 'error')
    }
  }
  
  const handleUpdate = (row: IncidentRow) => {
    setUpdateDialog({ id: row.id, status: row.status })
  }
  
  const handleResolve = (row: IncidentRow) => {
    setConfirmAction({ label: 'Mark this incident as resolved?', onConfirm: () => makeApiCall(row.id, 'resolve') })
  }
  
  const handleReopen = (row: IncidentRow) => {
    setConfirmAction({ label: 'Reopen this incident?', onConfirm: () => makeApiCall(row.id, 'reopen') })
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            (value as string) === 'resolved'
              ? 'bg-green-100 text-green-800'
              : (value as string) === 'investigating'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {value as string}
        </span>
      )
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value: unknown) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            (value as string) === 'critical'
              ? 'bg-red-100 text-red-800'
              : (value as string) === 'high'
              ? 'bg-orange-100 text-orange-800'
              : (value as string) === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {value as string}
        </span>
      )
    },
    { key: 'created_at', label: 'Created', render: (v: unknown) => formatDate(v as string) },
    { key: 'resolved_at', label: 'Resolved', render: (v: unknown) => ((v as string) ? formatDate(v as string) : 'N/A') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: unknown) => {
        const r = row as IncidentRow
        return (
          <div className="flex space-x-2">
            <button 
              onClick={() => handleView(r)} 
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              View
            </button>
            {r.status === 'active' && (
              <>
                <button 
                  onClick={() => handleUpdate(r)} 
                  disabled={loading === r.id}
                  className="text-yellow-600 hover:text-yellow-700 text-sm disabled:opacity-50"
                >
                  Update
                </button>
                <button 
                  onClick={() => handleResolve(r)} 
                  disabled={loading === r.id}
                  className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
                >
                  Resolve
                </button>
              </>
            )}
            {r.status === 'resolved' && (
              <button 
                onClick={() => handleReopen(r)} 
                disabled={loading === r.id}
                className="text-orange-600 hover:text-orange-700 text-sm disabled:opacity-50"
              >
                Reopen
              </button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="relative">
      <AdminTable columns={columns} data={incidents as unknown as Array<Record<string, unknown>>} />

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
