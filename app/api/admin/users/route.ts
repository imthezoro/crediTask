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
    // Select email directly from user_profiles now that the column exists
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

    // Optional server-side search by email
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    // Sorting
    const sortAsc = sortDir === 'asc'
    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: sortAsc })

    const { data: users, count, error: usersError } = await query.range(from, to)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const profiles = (users || []).map((p: any) => ({
      ...p,
      email: p.email || 'N/A',
    }))

    return NextResponse.json({
      users: profiles,
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
