'use client'

import AdminTable from '@/components/AdminTable'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  email?: string | null
  plan?: string | null
  usage_count?: number | null
  plan_valid_until?: string | null
  created_at?: string | null
  updated_at?: string | null
  is_active: boolean
  deleted_at?: string | null
}

interface AdminUsersTableProps {
  users: UserRow[]
}

export default function AdminUsersTable({ users }: AdminUsersTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | { label: string; onConfirm: () => void }>(null)
  const [editPlan, setEditPlan] = useState<null | { id: string; plan: string }>(null)
  const formatDate = (s: string) => {
    if (!s) return 'N/A'
    try {
      return new Date(s).toISOString().slice(0, 10) // YYYY-MM-DD in UTC
    } catch {
      return 'N/A'
    }
  }
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // End admin subtle loader when fresh users render (covers same-path query changes)
  useEffect(() => {
    try { window.dispatchEvent(new Event('admin:loading:end')) } catch {}
  }, [users])
  
  const makeApiCall = async (userId: string, action: string, data?: Record<string, unknown>) => {
    setLoading(userId)
    try { window.dispatchEvent(new Event('admin:loading:start')) } catch {}
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch(`/api/admin/users/${userId}`, {
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
      try { window.dispatchEvent(new Event('admin:loading:end')) } catch {}
    }
  }

  const handleEditPlan = (row: UserRow) => {
    setEditPlan({ id: row.id, plan: row.plan || 'free' })
  }
  
  const handleResetUsage = (row: UserRow) => {
    setConfirmAction({ label: 'Reset usage count to 0?', onConfirm: () => makeApiCall(row.id, 'reset-usage') })
  }
  
  const handleSuspend = (row: UserRow) => {
    setConfirmAction({ label: 'Suspend this user account?', onConfirm: () => makeApiCall(row.id, 'suspend') })
  }
  
  const handleReactivate = (row: UserRow) => {
    setConfirmAction({ label: 'Reactivate this user account?', onConfirm: () => makeApiCall(row.id, 'reactivate') })
  }

  const sortBy = searchParams.get('sortBy') || 'created_at'
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'
  const onSort = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const currentKey = params.get('sortBy') || 'created_at'
    const currentDir = (params.get('sortDir') as 'asc' | 'desc') || 'desc'
    const nextDir: 'asc' | 'desc' = currentKey === key && currentDir === 'asc' ? 'desc' : 'asc'
    params.set('sortBy', key)
    params.set('sortDir', nextDir)
    try { window.dispatchEvent(new Event('admin:loading:start')) } catch {}
    router.push(`/admin/users?${params.toString()}`)
  }

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'email',
      label: 'Email',
      render: (value: unknown) => {
        const v = (value as string) || ''
        return v && v.includes('@promptok.guest') ? 'Guest' : v
      }
    },
    {
      key: 'plan',
      label: 'Plan',
      sortable: true,
      render: (value: unknown) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {(value as string) || 'free'}
        </span>
      )
    },
    { key: 'usage_count', label: 'Usage Count', sortable: true },
    {
      key: 'plan_valid_until',
      label: 'Plan Valid Until',
      sortable: true,
      render: (value: unknown) => formatDate(value as string)
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: unknown) => formatDate(value as string)
    },
    {
      key: 'updated_at',
      label: 'Updated',
      sortable: true,
      render: (value: unknown) => formatDate(value as string)
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (value: unknown) => {
        const v = Boolean(value as boolean)
        return (
        <span className={`px-2 py-1 rounded-full text-xs ${
          v ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {v ? 'Active' : 'Suspended'}
        </span>
        )
      }
    },
    {
      key: 'deleted_at',
      label: 'Deleted At',
      sortable: true,
      render: (value: unknown) => {
        const v = value as string
        return v ? formatDate(v) : '—'
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: unknown) => {
        const r = row as UserRow
        return (
          <div className="flex space-x-2">
            <button 
              onClick={() => handleEditPlan(r)} 
              disabled={loading === r.id}
              className="text-blue-600 hover:text-blue-700 text-sm disabled:opacity-50"
            >
              Edit Plan
            </button>
            <button 
              onClick={() => handleResetUsage(r)} 
              disabled={loading === r.id}
              className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
            >
              Reset Usage
            </button>
            {r.is_active ? (
              <button 
                onClick={() => handleSuspend(r)} 
                disabled={loading === r.id}
                className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
              >
                Suspend
              </button>
            ) : (
              <button 
                onClick={() => handleReactivate(r)} 
                disabled={loading === r.id}
                className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="relative">
      <AdminTable columns={columns} data={users as unknown as Array<Record<string, unknown>>} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />

      {/* Non-blocking loading overlay */}
      {loading && (
        <div className="pointer-events-none fixed inset-0 flex items-end justify-end p-4 z-50">
          <div className="bg-white/80 backdrop-blur px-3 py-2 rounded shadow text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-gray-800" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Processing...
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

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

      {editPlan && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow p-4 w-96">
            <div className="text-sm font-medium text-gray-900 mb-2">Edit Plan</div>
            <div className="flex items-center gap-2 mb-4">
              <label className="text-sm text-gray-700">Plan</label>
              <select
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                value={editPlan.plan}
                onChange={(e) => setEditPlan({ ...editPlan, plan: e.target.value })}
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => setEditPlan(null)}>Cancel</button>
              <button
                className="px-3 py-1 bg-gray-900 text-white rounded text-sm"
                onClick={() => { const { id, plan } = editPlan; setEditPlan(null); makeApiCall(id, 'update', { plan }); }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
