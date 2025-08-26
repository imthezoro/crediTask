'use client'

import AdminTable from '@/components/AdminTable'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface AdminUsersTableProps {
  users: any[]
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
  
  const makeApiCall = async (userId: string, action: string, data?: any) => {
    setLoading(userId)
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
    } catch (error) {
      showToast('Action failed. Please try again.', 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleEditPlan = (row: any) => {
    setEditPlan({ id: row.id, plan: row.plan || 'free' })
  }
  
  const handleResetUsage = (row: any) => {
    setConfirmAction({ label: 'Reset usage count to 0?', onConfirm: () => makeApiCall(row.id, 'reset-usage') })
  }
  
  const handleSuspend = (row: any) => {
    setConfirmAction({ label: 'Suspend this user account?', onConfirm: () => makeApiCall(row.id, 'suspend') })
  }
  
  const handleReactivate = (row: any) => {
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
    router.push(`/admin/users?${params.toString()}`)
  }

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'email',
      label: 'Email',
      render: (value: string) => (value && value.includes('@promptok.guest') ? 'Guest' : value)
    },
    {
      key: 'plan',
      label: 'Plan',
      sortable: true,
      render: (value: string) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {value || 'free'}
        </span>
      )
    },
    { key: 'usage_count', label: 'Usage Count', sortable: true },
    {
      key: 'plan_valid_until',
      label: 'Plan Valid Until',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Active' : 'Suspended'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => handleEditPlan(row)} 
            disabled={loading === row.id}
            className="text-blue-600 hover:text-blue-700 text-sm disabled:opacity-50"
          >
            Edit Plan
          </button>
          <button 
            onClick={() => handleResetUsage(row)} 
            disabled={loading === row.id}
            className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
          >
            Reset Usage
          </button>
          {row.is_active ? (
            <button 
              onClick={() => handleSuspend(row)} 
              disabled={loading === row.id}
              className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
            >
              Suspend
            </button>
          ) : (
            <button 
              onClick={() => handleReactivate(row)} 
              disabled={loading === row.id}
              className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
            >
              Reactivate
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="relative">
      <AdminTable columns={columns} data={users} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />

      {/* Non-blocking loading overlay */}
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
