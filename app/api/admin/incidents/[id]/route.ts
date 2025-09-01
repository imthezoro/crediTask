import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const incidentId = params.id

    // Get incident details
    const { data: incident, error: incidentError } = await admin
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    }

    return NextResponse.json(incident)

  } catch (error) {
    console.error('Admin incident detail API error:', error)
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
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const incidentId = params.id
    const body = await request.json()
    const { action, ...updateData } = body

    if (action === 'resolve') {
      const { error: updateError } = await admin
        .from('incidents')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Incident resolved successfully' })
    }

    if (action === 'investigating') {
      const { error: updateError } = await admin
        .from('incidents')
        .update({ 
          status: 'investigating',
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Incident status updated to investigating' })
    }

    if (action === 'reopen') {
      const { error: updateError } = await admin
        .from('incidents')
        .update({ 
          status: 'active',
          resolved_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Incident reopened successfully' })
    }

    // General incident update
    const allowedFields = ['title', 'description', 'status', 'severity'] as const
    type AllowedField = typeof allowedFields[number]
    type IncidentUpdate = Partial<
      Record<AllowedField, string> & { updated_at?: string; resolved_at?: string | null }
    >
    const filteredData: IncidentUpdate = Object.keys(updateData)
      .filter((key): key is AllowedField => (allowedFields as readonly string[]).includes(key))
      .reduce<IncidentUpdate>((obj, key) => {
        obj[key] = updateData[key]
        return obj
      }, {})

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    filteredData.updated_at = new Date().toISOString()

    // If status is being set to resolved, add resolved_at timestamp
    if (filteredData.status === 'resolved') {
      filteredData.resolved_at = new Date().toISOString()
    } else if (filteredData.status === 'active' || filteredData.status === 'investigating') {
      filteredData.resolved_at = null
    }

    const { error: updateError } = await admin
      .from('incidents')
      .update(filteredData)
      .eq('id', incidentId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Incident updated successfully' })

  } catch (error) {
    console.error('Admin incident update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const incidentId = params.id

    const { error: deleteError } = await admin
      .from('incidents')
      .delete()
      .eq('id', incidentId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Incident deleted successfully' })

  } catch (error) {
    console.error('Admin incident delete API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
