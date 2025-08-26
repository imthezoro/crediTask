import { createServerClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminUsersTable from '@/components/AdminUsersTable'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'
import PageSizeSelector from '@/components/PageSizeSelector'

type Query = {
  page: number
  pageSize: number
  plan?: string
  status?: string
  sortBy?: 'created_at' | 'plan' | 'usage_count' | 'is_active'
  sortDir?: 'asc' | 'desc'
  minUsage?: number
  maxUsage?: number
}

async function getUsers(q: Query) {
  const supabase = createServerClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }

  const from = (q.page - 1) * q.pageSize
  const to = from + q.pageSize - 1

  // Fetch current page with total count
  let query = adminClient
    .from('user_profiles')
    .select('*', { count: 'exact' })

  // Server-side filters (schema-backed)
  if (q.plan) {
    query = query.eq('plan', q.plan)
  }
  if (q.status === 'active') {
    query = query.eq('is_active', true)
  } else if (q.status === 'suspended') {
    query = query.eq('is_active', false)
  }
  if (typeof q.minUsage === 'number' && !Number.isNaN(q.minUsage)) {
    query = query.gte('usage_count', q.minUsage)
  }
  if (typeof q.maxUsage === 'number' && !Number.isNaN(q.maxUsage)) {
    query = query.lte('usage_count', q.maxUsage)
  }

  // Sorting (schema-backed columns)
  const sortBy = q.sortBy || 'created_at'
  const sortAsc = (q.sortDir || 'desc') === 'asc'
  query = query.order(sortBy, { ascending: sortAsc, nullsFirst: sortAsc })

  const { data: users, count } = await query.range(from, to)

  const profiles = users || []

  // Build email map for only current page via Admin API
  const userIds = profiles.map((p: any) => p.id)
  const emailMap: Record<string, string> = {}
  for (const id of userIds) {
    try {
      const { data } = await adminClient.auth.admin.getUserById(id)
      if (data?.user?.email) emailMap[id] = data.user.email
    } catch {}
  }

  // Enrich profiles with email field expected by AdminUsersTable
  const enriched = profiles.map((p: any) => ({
    ...p,
    email: emailMap[p.id] || 'N/A'
  }))

  return { users: enriched, total: count || 0 }
}

export default async function AdminUsersPage({ searchParams }: { searchParams?: { page?: string; pageSize?: string; plan?: string; status?: string; sortBy?: string; sortDir?: string; q?: string; minUsage?: string; maxUsage?: string } }) {
  const page = Math.max(parseInt(searchParams?.page || '1', 10), 1)
  const pageSize = Math.min(Math.max(parseInt(searchParams?.pageSize || '20', 10), 5), 100)
  const plan = (searchParams?.plan || '').trim() || undefined
  const status = (searchParams?.status || '').trim() || undefined
  const sortBy = (searchParams?.sortBy as Query['sortBy']) || 'created_at'
  const sortDir = (searchParams?.sortDir as Query['sortDir']) || 'desc'
  const q = (searchParams?.q || '').trim()
  const minUsage = searchParams?.minUsage ? Number(searchParams.minUsage) : undefined
  const maxUsage = searchParams?.maxUsage ? Number(searchParams.maxUsage) : undefined

  const { users: serverUsers, total } = await getUsers({ page, pageSize, plan, status, sortBy, sortDir, minUsage, maxUsage })
  // Email search (client-limited: filters current page only due to API constraints)
  const users = q ? serverUsers.filter(u => (u.email || '').toLowerCase().includes(q.toLowerCase())) : serverUsers

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, total)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <AdminNav />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Users ({total.toLocaleString()})</h2>
              <div className="flex items-center gap-3">
              <form className="flex flex-wrap gap-2" method="GET">
                <input
                  type="text"
                  name="q"
                  placeholder="Search email..."
                  defaultValue={q}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select name="plan" defaultValue={plan || ''} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <select name="status" defaultValue={status || ''} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <input type="number" name="minUsage" placeholder="Min usage" defaultValue={minUsage ?? ''} className="px-3 py-2 border border-gray-300 rounded-md text-sm w-28" />
                <input type="number" name="maxUsage" placeholder="Max usage" defaultValue={maxUsage ?? ''} className="px-3 py-2 border border-gray-300 rounded-md text-sm w-28" />
                <button type="submit" className="px-3 py-2 bg-gray-800 text-white rounded-md text-sm">Apply</button>
                <Link href="/admin/users" className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700">Clear Filters</Link>
              </form>
              {/* Separate compact page-size control (auto-submit on change) */}
              <PageSizeSelector
                action="/admin/users"
                pageSize={pageSize}
                params={{
                  q,
                  plan: plan || '',
                  status: status || '',
                  sortBy,
                  sortDir,
                  minUsage: (minUsage ?? ''),
                  maxUsage: (maxUsage ?? ''),
                  page
                }}
              />
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <AdminUsersTable users={users} />
            <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
              <span>
                Showing {showingFrom}-{showingTo} of {total.toLocaleString()}
              </span>
              <div className="space-x-2">
                <Link
                  href={`/admin/users?page=${Math.max(page - 1, 1)}&pageSize=${pageSize}&plan=${plan || ''}&status=${status || ''}&sortBy=${sortBy}&sortDir=${sortDir}&q=${encodeURIComponent(q)}&minUsage=${minUsage ?? ''}&maxUsage=${maxUsage ?? ''}`}
                  className={`px-3 py-1 border rounded ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                  aria-disabled={page <= 1}
                >
                  Prev
                </Link>
                <Link
                  href={`/admin/users?page=${Math.min(page + 1, totalPages)}&pageSize=${pageSize}&plan=${plan || ''}&status=${status || ''}&sortBy=${sortBy}&sortDir=${sortDir}&q=${encodeURIComponent(q)}&minUsage=${minUsage ?? ''}&maxUsage=${maxUsage ?? ''}`}
                  className={`px-3 py-1 border rounded ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                  aria-disabled={page >= totalPages}
                >
                  Next
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
