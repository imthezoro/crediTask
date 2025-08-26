'use client'

import AdminTable from '@/components/AdminTable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface AdminUsersTableProps {
  users: any[]
}

export default function AdminUsersTable({ users }: AdminUsersTableProps) {
  const router = useRouter()
  const goDetails = (row: any, extra?: string) => {
    const url = `/admin/users/${row.id}${extra ? extra : ''}`
    router.push(url)
  }
  const handleEditPlan = (row: any) => goDetails(row, '?tab=plan')
  const handleResetUsage = (row: any) => goDetails(row, '?action=reset-usage')
  const handleSuspend = (row: any) => goDetails(row, '?action=suspend')

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
      render: (value: string) => (
        <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {value || 'free'}
        </span>
      )
    },
    { key: 'usage_count', label: 'Usage Count' },
    {
      key: 'plan_valid_until',
      label: 'Plan Valid Until',
      render: (value: string) => (value ? new Date(value).toLocaleDateString() : 'N/A')
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex space-x-2">
          <button onClick={() => handleEditPlan(row)} className="text-blue-600 hover:text-blue-700 text-sm">
            Edit Plan
          </button>
          <button onClick={() => handleResetUsage(row)} className="text-green-600 hover:text-green-700 text-sm">
            Reset Usage
          </button>
          <button onClick={() => handleSuspend(row)} className="text-red-600 hover:text-red-700 text-sm">
            Suspend
          </button>
        </div>
      )
    }
  ]

  return <AdminTable columns={columns} data={users} />
}
