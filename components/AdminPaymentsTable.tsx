'use client'

import AdminTable from '@/components/AdminTable'

interface AdminPaymentsTableProps {
  payments: any[]
}

export default function AdminPaymentsTable({ payments }: AdminPaymentsTableProps) {
  const handleView = (row: any) => {
    console.log('View payment', row)
    alert(`View payment ${row.id}`)
  }
  const handleMarkCompleted = (row: any) => {
    console.log('Mark completed', row)
    alert(`Mark payment ${row.id} as completed`)
  }
  const handleRefund = (row: any) => {
    console.log('Refund', row)
    alert(`Refund payment ${row.id}`)
  }

  const columns = [
    { key: 'id', label: 'Payment ID' },
    {
      key: 'user_profiles',
      label: 'User Email',
      render: (value: any) => value?.email || 'N/A'
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
          <button onClick={() => handleView(row)} className="text-blue-600 hover:text-blue-700 text-sm">View Details</button>
          {row.status === 'pending' && (
            <button onClick={() => handleMarkCompleted(row)} className="text-green-600 hover:text-green-700 text-sm">Mark Completed</button>
          )}
          {row.status === 'completed' && (
            <button onClick={() => handleRefund(row)} className="text-red-600 hover:text-red-700 text-sm">Refund</button>
          )}
        </div>
      )
    }
  ]

  return <AdminTable columns={columns} data={payments} />
}
