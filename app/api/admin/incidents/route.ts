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
    const status = url.searchParams.get('status')
    const severity = url.searchParams.get('severity')
    const sortBy = (url.searchParams.get('sortBy') as 'created_at' | 'status' | 'severity') || 'created_at'
    const sortDir = (url.searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Fetch current page with total count using admin client
    let query = admin
      .from('incidents')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, to)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity)
    }

    const { data: incidents, count, error: incidentsError } = await query

    if (incidentsError) {
      return NextResponse.json({ error: incidentsError.message }, { status: 500 })
    }

    return NextResponse.json({
      incidents: incidents || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil((count || 0) / pageSize), 1)
    })

  } catch (error) {
    console.error('Admin incidents API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, severity = 'medium' } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data: incident, error: createError } = await admin
      .from('incidents')
      .insert({
        title,
        description,
        severity,
        status: 'active'
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json(incident, { status: 201 })

  } catch (error) {
    console.error('Admin create incident API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
