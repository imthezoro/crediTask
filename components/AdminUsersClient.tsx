'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdminUsersTable from '@/components/AdminUsersTable'
import LoadingTable from '@/components/LoadingTable'

interface User {
  id: string
  email: string
  plan: string
  usage_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  plan_valid_until: string | null
  deleted_at: string | null
  is_admin: boolean
  is_guest: boolean
  device_id: string | null
  ip_address: string | null
}

interface UsersResponse {
  users: User[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface FilterState {
  page: number
  pageSize: number
  plan: string
  status: string
  sortBy: string
  sortDir: string
  q: string
  minUsage: string
  maxUsage: string
}

export default function AdminUsersClient() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize filter state from URL params
  const [filters, setFilters] = useState<FilterState>({
    page: Math.max(parseInt(searchParams.get('page') || '1', 10), 1),
    pageSize: Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 5), 100),
    plan: searchParams.get('plan') || '',
    status: searchParams.get('status') || '',
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortDir: searchParams.get('sortDir') || 'desc',
    q: searchParams.get('q') || '',
    minUsage: searchParams.get('minUsage') || '',
    maxUsage: searchParams.get('maxUsage') || ''
  })

  // Update URL when filters change
  const updateURL = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value.toString())
      }
    })
    router.push(`/admin/users?${params.toString()}`, { scroll: false })
  }, [router])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }
    setFilters(updatedFilters)
    updateURL(updatedFilters)
  }, [filters, updateURL])

  // Handle page changes
  const handlePageChange = useCallback((newPage: number) => {
    const updatedFilters = { ...filters, page: newPage }
    setFilters(updatedFilters)
    updateURL(updatedFilters)
  }, [filters, updateURL])

  // Fetch users data
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
        ...(filters.plan && { plan: filters.plan }),
        ...(filters.status && { status: filters.status }),
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        ...(filters.q && { q: filters.q }),
        ...(filters.minUsage && { minUsage: filters.minUsage }),
        ...(filters.maxUsage && { maxUsage: filters.maxUsage })
      })

      const response = await fetch(`/api/admin/users?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">Error loading users</div>
          <div className="text-gray-500 text-sm">{error}</div>
          <button 
            onClick={fetchUsers} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const showingFrom = data?.total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1
  const showingTo = data ? Math.min(filters.page * filters.pageSize, data.total) : 0

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    handleFilterChange({
      q: formData.get('q') as string || '',
      plan: formData.get('plan') as string || '',
      status: formData.get('status') as string || '',
      minUsage: formData.get('minUsage') as string || '',
      maxUsage: formData.get('maxUsage') as string || ''
    })
  }

  const clearFilters = useCallback(() => {
    const clearedFilters: FilterState = {
      page: 1,
      pageSize: filters.pageSize,
      plan: '',
      status: '',
      sortBy: 'created_at',
      sortDir: 'desc',
      q: '',
      minUsage: '',
      maxUsage: ''
    }
    setFilters(clearedFilters)
    updateURL(clearedFilters)
  }, [filters.pageSize, updateURL])

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Users {data ? `(${data.total.toLocaleString()})` : ''}
          </h2>
          <div className="flex items-center gap-3">
            <form className="flex flex-wrap gap-2" onSubmit={handleFormSubmit}>
              <input
                type="text"
                name="q"
                placeholder="Search email..."
                defaultValue={filters.q}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <select name="plan" defaultValue={filters.plan} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select name="status" defaultValue={filters.status} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <input 
                type="number" 
                name="minUsage" 
                placeholder="Min usage" 
                defaultValue={filters.minUsage} 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-28" 
              />
              <input 
                type="number" 
                name="maxUsage" 
                placeholder="Max usage" 
                defaultValue={filters.maxUsage} 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-28" 
              />
              <button type="submit" className="px-3 py-2 bg-gray-800 text-white rounded-md text-sm">
                Apply
              </button>
              <button 
                type="button" 
                onClick={clearFilters}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {loading ? (
          <LoadingTable rows={filters.pageSize} columns={6} />
        ) : data?.users ? (
          <AdminUsersTable users={data.users} />
        ) : null}
        
        {data && (
          <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
            <span>
              Showing {showingFrom}-{showingTo} of {data.total.toLocaleString()}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => handlePageChange(Math.max(filters.page - 1, 1))}
                disabled={filters.page <= 1}
                className={`px-3 py-1 border rounded ${filters.page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-gray-50'}`}
              >
                Prev
              </button>
              <button
                onClick={() => handlePageChange(Math.min(filters.page + 1, data.totalPages))}
                disabled={filters.page >= data.totalPages}
                className={`px-3 py-1 border rounded ${filters.page >= data.totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-gray-50'}`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
