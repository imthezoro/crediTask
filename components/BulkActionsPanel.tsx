'use client'

import { useState } from 'react'

export default function BulkActionsPanel() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExportUsers = async () => {
    setLoading('export')
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch('/api/admin/export?type=users&format=csv', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'users_export.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      alert('Export failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleSendNotification = () => {
    const message = prompt('Enter notification message:')
    if (message) {
      alert('Notification feature coming soon!')
    }
  }

  const handleResetAllUsage = () => {
    if (confirm('Reset usage count for ALL users? This action cannot be undone.')) {
      alert('Bulk reset feature coming soon!')
    }
  }

  return (
    <div className="mt-6 bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Actions</h3>
      <div className="flex space-x-4">
        <button 
          onClick={handleExportUsers}
          disabled={loading === 'export'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading === 'export' ? 'Exporting...' : 'Export Users'}
        </button>
        <button 
          onClick={handleSendNotification}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Send Notification
        </button>
        <button 
          onClick={handleResetAllUsage}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Reset Usage (All)
        </button>
      </div>
    </div>
  )
}
