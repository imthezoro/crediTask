import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
    const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '20'), 5), 100)
    const plan = url.searchParams.get('plan') || undefined
    const status = url.searchParams.get('status') || undefined
    const sortBy = (url.searchParams.get('sortBy') as 'created_at' | 'plan' | 'usage_count' | 'is_active') || 'created_at'
    const sortDir = (url.searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'
    const minUsage = url.searchParams.get('minUsage') ? Number(url.searchParams.get('minUsage')) : undefined
    const maxUsage = url.searchParams.get('maxUsage') ? Number(url.searchParams.get('maxUsage')) : undefined
    const search = url.searchParams.get('q') || ''

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Fetch current page with total count using admin client
    let query = admin
      .from('user_profiles')
      .select('*', { count: 'exact' })

    // Server-side filters
    if (plan) {
      query = query.eq('plan', plan)
    }
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'suspended') {
      query = query.eq('is_active', false)
    }
    if (typeof minUsage === 'number' && !Number.isNaN(minUsage)) {
      query = query.gte('usage_count', minUsage)
    }
    if (typeof maxUsage === 'number' && !Number.isNaN(maxUsage)) {
      query = query.lte('usage_count', maxUsage)
    }

    // Sorting
    const sortAsc = sortDir === 'asc'
    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: sortAsc })

    const { data: users, count, error: usersError } = await query.range(from, to)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const profiles = users || []

    // Build email map for only current page via Admin API
    const userIds = profiles.map((p: any) => p.id)
    const emailMap: Record<string, string> = {}
    for (const id of userIds) {
      try {
        const { data } = await admin.auth.admin.getUserById(id)
        if (data?.user?.email) emailMap[id] = data.user.email
      } catch {}
    }

    // Enrich profiles with email field
    let enrichedUsers = profiles.map((p: any) => ({
      ...p,
      email: emailMap[p.id] || 'N/A'
    }))

    // Apply email search filter (client-side for current page)
    if (search) {
      enrichedUsers = enrichedUsers.filter((u: any) => 
        (u.email || '').toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json({
      users: enrichedUsers,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil((count || 0) / pageSize), 1)
    })

  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
