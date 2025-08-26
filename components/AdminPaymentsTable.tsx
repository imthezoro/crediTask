'use client'

import AdminTable from '@/components/AdminTable'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminPaymentsTableProps {
  payments: any[]
}

export default function AdminPaymentsTable({ payments }: AdminPaymentsTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
  const makeApiCall = async (paymentId: string, action: string, data?: any) => {
    setLoading(paymentId)
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

      const response = await fetch(`/api/admin/payments/${row.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const payment = await response.json()
        alert(`Payment Details:\nID: ${payment.id}\nUser: ${payment.user_email}\nAmount: ${payment.currency?.toUpperCase()} ${(payment.amount_cents / 100).toFixed(2)}\nStatus: ${payment.status}\nProvider: ${payment.provider}\nCreated: ${new Date(payment.created_at).toLocaleString()}`)
      }
    } catch (error) {
      alert('Failed to load payment details')
    }
  }
  
  const handleMarkCompleted = (row: any) => {
    if (confirm('Mark this payment as completed?')) {
      makeApiCall(row.id, 'mark-completed')
    }
  }
  
  const handleRefund = (row: any) => {
    if (confirm('Process refund for this payment?')) {
      makeApiCall(row.id, 'refund')
    }
  }

  const columns = [
    { key: 'id', label: 'Payment ID' },
    {
      key: 'user_email',
      label: 'User Email',
      render: (value: string) => value || 'N/A'
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (value: string) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">{value}</span>
      )
    },
    {
      key: 'amount_cents',
      label: 'Amount',
      render: (value: number, row: any) => `${row.currency?.toUpperCase() || 'USD'} ${(value / 100).toFixed(2)}`
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'completed'
              ? 'bg-green-100 text-green-800'
              : value === 'pending'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value}
        </span>
      )
    },
    { key: 'provider', label: 'Provider', render: (value: string) => <span className="capitalize">{value}</span> },
    { key: 'created_at', label: 'Date', render: (value: string) => new Date(value).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex space-x-2">
          <button 
            onClick={() => handleView(row)} 
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            View Details
          </button>
          {row.status === 'pending' && (
            <button 
              onClick={() => handleMarkCompleted(row)} 
              disabled={loading === row.id}
              className="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
            >
              Mark Completed
            </button>
          )}
          {row.status === 'completed' && (
            <button 
              onClick={() => handleRefund(row)} 
              disabled={loading === row.id}
              className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
            >
              Refund
            </button>
          )}
        </div>
      )
    }
  ]

  return <AdminTable columns={columns} data={payments} />
}
