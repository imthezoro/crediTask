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

    const paymentId = params.id

    // Get payment details
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Get user email
    const { data: authUser } = await admin.auth.admin.getUserById(payment.user_id)

    return NextResponse.json({
      ...payment,
      user_email: authUser.user?.email || 'N/A'
    })

  } catch (error) {
    console.error('Admin payment detail API error:', error)
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

    const paymentId = params.id
    const body = await request.json()
    const { action, ...updateData } = body

    if (action === 'mark-completed') {
      const { error: updateError } = await admin
        .from('payments')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Payment marked as completed' })
    }

    if (action === 'refund') {
      const { error: updateError } = await admin
        .from('payments')
        .update({ 
          status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Payment refunded successfully' })
    }

    if (action === 'mark-failed') {
      const { error: updateError } = await admin
        .from('payments')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Payment marked as failed' })
    }

    // General payment update
    const allowedFields = ['status', 'amount_cents', 'currency', 'plan']
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updateData[key]
        return obj
      }, {})

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    filteredData.updated_at = new Date().toISOString()

    const { error: updateError } = await admin
      .from('payments')
      .update(filteredData)
      .eq('id', paymentId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Payment updated successfully' })

  } catch (error) {
    console.error('Admin payment update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
