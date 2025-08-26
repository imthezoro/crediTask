import { createServerClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = params.id

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    
    // Get user's prompt sessions
    const { data: sessions } = await supabase
      .from('prompt_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get user's payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      profile: {
        ...profile,
        email: authUser.user?.email || 'N/A'
      },
      sessions: sessions || [],
      payments: payments || []
    })

  } catch (error) {
    console.error('Admin user detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = params.id
    const body = await request.json()
    const { action, ...updateData } = body

    if (action === 'reset-usage') {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ usage_count: 0 })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Usage reset successfully' })
    }

    if (action === 'suspend') {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          is_active: false,
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Add to blocked emails if email exists
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      if (authUser.user?.email) {
        const blockedUntil = new Date()
        blockedUntil.setDate(blockedUntil.getDate() + 30) // Block for 30 days

        await supabase
          .from('blocked_emails')
          .upsert({
            email: authUser.user.email,
            blocked_until: blockedUntil.toISOString()
          })
      }

      return NextResponse.json({ message: 'User suspended successfully' })
    }

    if (action === 'reactivate') {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          is_active: true,
          deleted_at: null
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Remove from blocked emails
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      if (authUser.user?.email) {
        await supabase
          .from('blocked_emails')
          .delete()
          .eq('email', authUser.user.email)
      }

      return NextResponse.json({ message: 'User reactivated successfully' })
    }

    // General profile update
    const allowedFields = ['plan', 'plan_valid_until', 'is_admin']
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updateData[key]
        return obj
      }, {})

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(filteredData)
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'User updated successfully' })

  } catch (error) {
    console.error('Admin user update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
