'use client'

import AdminTable from '@/components/AdminTable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface AdminUsersTableProps {
  users: any[]
}

export default function AdminUsersTable({ users }: AdminUsersTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
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
      alert(result.message || 'Action completed successfully')
      router.refresh()
    } catch (error) {
      alert('Action failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleEditPlan = (row: any) => {
    const newPlan = prompt('Enter new plan (free, pro, enterprise):', row.plan)
    if (newPlan && ['free', 'pro', 'enterprise'].includes(newPlan)) {
      makeApiCall(row.id, 'update', { plan: newPlan })
    }
  }
  
  const handleResetUsage = (row: any) => {
    if (confirm('Reset usage count to 0?')) {
      makeApiCall(row.id, 'reset-usage')
    }
  }
  
  const handleSuspend = (row: any) => {
    if (confirm('Suspend this user account?')) {
      makeApiCall(row.id, 'suspend')
    }
  }
  
  const handleReactivate = (row: any) => {
    if (confirm('Reactivate this user account?')) {
      makeApiCall(row.id, 'reactivate')
    }
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
      key: 'is_active',
      label: 'Status',
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

  return <AdminTable columns={columns} data={users} />
}
