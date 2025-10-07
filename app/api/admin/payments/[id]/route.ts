import { createClient, createAdminClient, isUserAdmin } from '@/lib/supabase/server'
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
      .select('id, provider, provider_payment_id, amount_cents, currency, status, plan, valid_from, valid_to, user_id, created_at')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Resolve user email from user_profiles (prefer) and only fallback if needed
    let userEmail: string | null = null
    const { data: profile } = await admin
      .from('user_profiles')
      .select('email')
      .eq('id', payment.user_id)
      .single()
    userEmail = (profile as { email: string } | null)?.email ?? null

    if (!userEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(payment.user_id)
      userEmail = authUser.user?.email || null
    }

    return NextResponse.json({
      ...payment,
      user_email: userEmail || 'N/A'
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
    
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    
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
    const allowedFields = ['status', 'amount_cents', 'currency', 'plan'] as const
    type AllowedField = typeof allowedFields[number]
    type PaymentUpdate = Partial<Record<AllowedField, string | number> & { updated_at?: string }>
    const filteredData: PaymentUpdate = Object.keys(updateData)
      .filter((key): key is AllowedField => (allowedFields as readonly string[]).includes(key))
      .reduce<PaymentUpdate>((obj, key) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        obj[key] = updateData[key] as unknown as string | number
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
