'use client'

import AdminTable from '@/components/AdminTable'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PaymentRow {
  id: string
  user_email?: string | null
  plan?: string | null
  amount_cents: number
  currency?: string | null
  status: string
  provider?: string | null
  created_at?: string | null
  [key: string]: unknown
}

interface AdminPaymentsTableProps {
  payments: PaymentRow[]
}

export default function AdminPaymentsTable({ payments }: AdminPaymentsTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | { label: string; onConfirm: () => void }>(null)
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
  
  const makeApiCall = async (paymentId: string, action: string, data?: Record<string, unknown>) => {
    setLoading(paymentId)
    try { window.dispatchEvent(new Event('admin:loading:start')) } catch {}
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch(`/api/admin/payments/${paymentId}`, {
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

  const handleView = async (row: PaymentRow) => {
    try {
      try { window.dispatchEvent(new Event('admin:loading:start')) } catch {}
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch(`/api/admin/payments/${row.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await response.json()
        // Could show a small inline details panel; using a toast for now
        showToast('Loaded payment details', 'success')
      }
    } catch {
      showToast('Failed to load payment details', 'error')
    } finally {
      try { window.dispatchEvent(new Event('admin:loading:end')) } catch {}
    }
  }
  
  const handleMarkCompleted = (row: PaymentRow) => {
    setConfirmAction({ label: 'Mark this payment as completed?', onConfirm: () => makeApiCall(row.id, 'mark-completed') })
  }
  
  const handleRefund = (row: PaymentRow) => {
    setConfirmAction({ label: 'Process refund for this payment?', onConfirm: () => makeApiCall(row.id, 'refund') })
  }

  const columns = [
    { key: 'id', label: 'Payment ID' },
    {
      key: 'user_email',
      label: 'User Email',
      render: (value: unknown) => (value as string) || 'N/A'
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (value: unknown) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">{(value as string) || 'N/A'}</span>
      )
    },
    {
      key: 'amount_cents',
      label: 'Amount',
      render: (value: unknown, row: unknown) => {
        const v = Number(value as number)
        const r = row as PaymentRow
        const cur = (r.currency || 'USD').toString().toUpperCase()
        return `${cur} ${(v / 100).toFixed(2)}`
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            (value as string) === 'completed'
              ? 'bg-green-100 text-green-800'
              : (value as string) === 'pending'
              ? 'bg-yellow-100 text-yellow-800'
              : (value as string) === 'failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value as string}
        </span>
      )
    },
    { key: 'provider', label: 'Provider', render: (value: unknown) => <span className="capitalize">{value as string}</span> },
    { key: 'created_at', label: 'Date', render: (value: unknown) => formatDate(value as string) },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: unknown) => {
        const r = row as PaymentRow
        return (
          <div className="flex space-x-2">
            <button 
              onClick={() => handleView(r)} 
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              View Details
            </button>
            {r.status === 'pending' && (
              <button 
                onClick={() => handleMarkCompleted(r)} 
                disabled={loading === r.id}
                className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
              >
                Mark Completed
              </button>
            )}
            {r.status === 'completed' && (
              <button 
                onClick={() => handleRefund(r)} 
                disabled={loading === r.id}
                className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
              >
                Refund
              </button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="relative">
      <AdminTable columns={columns} data={payments as unknown as Array<Record<string, unknown>>} />

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
    </div>
  )
}
