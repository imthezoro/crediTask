import { createClient } from './supabase-server'

export interface PaymentData {
  provider: 'stripe' | 'razorpay'
  provider_payment_id: string
  amount_cents: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  plan: 'free' | 'pro' | 'enterprise'
  valid_from: string
  valid_to: string
  user_id: string
}

export async function reconcilePayment(paymentData: PaymentData) {
  const supabase = await createClient()
  
  // Insert payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      provider: paymentData.provider,
      provider_payment_id: paymentData.provider_payment_id,
      amount_cents: paymentData.amount_cents,
      currency: paymentData.currency,
      status: paymentData.status,
      plan: paymentData.plan,
      valid_from: paymentData.valid_from,
      valid_to: paymentData.valid_to,
      user_id: paymentData.user_id,
      created_at: new Date().toISOString()
    })
    .select('id, provider, provider_payment_id, amount_cents, currency, status, plan, valid_from, valid_to, user_id, created_at')
    .single()

  if (paymentError) {
    throw new Error(`Failed to insert payment: ${paymentError.message}`)
  }

  // Update user profile if payment is completed
  if (paymentData.status === 'completed') {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        plan: paymentData.plan,
        plan_valid_until: paymentData.valid_to
      })
      .eq('id', paymentData.user_id)

    if (profileError) {
      throw new Error(`Failed to update user profile: ${profileError.message}`)
    }
  }

  return payment
}
