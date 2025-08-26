import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = createServerClient()
    
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const plan = url.searchParams.get('plan')
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        plan,
        usage_count,
        plan_valid_until,
        created_at,
        updated_at,
        is_active,
        is_admin,
        is_guest,
        device_id,
        ip_address
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (plan && plan !== 'all') {
      query = query.eq('plan', plan)
    }
    
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    const { data: users, error: usersError } = await query

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Get user emails from auth.users (admin can access)
    const userIds = users?.map(u => u.id) || []
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    
    const emailMap = authUsers.users.reduce((acc: any, user) => {
      acc[user.id] = user.email
      return acc
    }, {})

    // Combine profile data with emails
    const enrichedUsers = users?.map(user => ({
      ...user,
      email: emailMap[user.id] || 'N/A'
    })) || []

    // Apply search filter after enriching with emails
    let filteredUsers = enrichedUsers
    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = enrichedUsers.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        user.id.toLowerCase().includes(searchLower) ||
        user.plan.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      users: filteredUsers,
      total: filteredUsers.length
    })

  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
