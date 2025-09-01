'use client'

import { useState } from 'react'

interface AnalyticsDataRow {
  date: string;
  usage: number;
  successful: number;
  failed: number;
  avgResponseTime: number;
}

export default function AnalyticsExportPanel() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExportCSV = async () => {
    setLoading('csv')
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1]

      const response = await fetch('/api/admin/analytics?period=30&type=usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const csvContent = [
          'Date,Usage,Successful,Failed,Avg Response Time',
          ...data.data.map((row: AnalyticsDataRow) => 
            `${row.date},${row.usage},${row.successful},${row.failed},${row.avgResponseTime}`
          )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'analytics_export.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Export failed')
      }
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleGenerateReport = () => {
    alert('Report generation coming soon!')
  }

  const handleScheduleReport = () => {
    alert('Report scheduling coming soon!')
  }

  return (
    <div className="mt-8 bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Analytics</h3>
      <div className="flex space-x-4">
        <button 
          onClick={handleExportCSV}
          disabled={loading === 'csv'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading === 'csv' ? 'Exporting...' : 'Export CSV'}
        </button>
        <button 
          onClick={handleGenerateReport}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Generate Report
        </button>
        <button 
          onClick={handleScheduleReport}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Schedule Report
        </button>
      </div>
    </div>
  )
}
