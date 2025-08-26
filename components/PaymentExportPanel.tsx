'use client'

import { useState } from 'react'

export default function PaymentExportPanel() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExportPayments = async () => {
    setLoading('export')
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch('/api/admin/export?type=payments&format=csv', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'payments_export.csv'
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

  const handleMonthlyReport = () => {
    alert('Monthly report generation coming soon!')
  }

  const handleTaxReport = () => {
    alert('Tax report generation coming soon!')
  }

  return (
    <div className="mt-6 bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Export & Reports</h3>
      <div className="flex space-x-4">
        <button 
          onClick={handleExportPayments}
          disabled={loading === 'export'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading === 'export' ? 'Exporting...' : 'Export CSV'}
        </button>
        <button 
          onClick={handleMonthlyReport}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Monthly Report
        </button>
        <button 
          onClick={handleTaxReport}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Tax Report
        </button>
      </div>
    </div>
  )
}
