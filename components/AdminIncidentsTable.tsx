'use client'

import AdminTable from '@/components/AdminTable'

interface AdminIncidentsTableProps {
  incidents: any[]
}

export default function AdminIncidentsTable({ incidents }: AdminIncidentsTableProps) {
  const handleView = (row: any) => {
    console.log('View incident', row)
    alert(`View incident ${row.id}`)
  }
  const handleUpdate = (row: any) => {
    console.log('Update incident', row)
    alert(`Update incident ${row.id}`)
  }
  const handleResolve = (row: any) => {
    console.log('Resolve incident', row)
    alert(`Resolve incident ${row.id}`)
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
          <button onClick={() => handleView(row)} className="text-blue-600 hover:text-blue-700 text-sm">View</button>
          {row.status === 'active' && (
            <>
              <button onClick={() => handleUpdate(row)} className="text-yellow-600 hover:text-yellow-700 text-sm">Update</button>
              <button onClick={() => handleResolve(row)} className="text-green-600 hover:text-green-700 text-sm">Resolve</button>
            </>
          )}
        </div>
      )
    }
  ]

  return <AdminTable columns={columns} data={incidents} />
}
