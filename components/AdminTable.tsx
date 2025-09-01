'use client'

import type React from 'react'

interface Column {
  key: string
  label: string
  render?: (value: unknown, row: unknown) => React.ReactNode
  sortable?: boolean
}

interface AdminTableProps {
  columns: Column[]
  data: Array<Record<string, unknown>>
  loading?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export default function AdminTable({ columns, data, loading, sortBy, sortDir, onSort }: AdminTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {onSort && column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="flex items-center gap-1 select-none hover:text-gray-700"
                    aria-label={`Sort by ${column.label}`}
                  >
                    <span>{column.label}</span>
                    <span className="text-[10px] leading-none">
                      {sortBy === column.key ? (
                        sortDir === 'asc' ? '▲' : '▼'
                      ) : (
                        '↕'
                      )}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {column.render ? column.render(row[column.key], row) : (row[column.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
