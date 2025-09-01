import { NextResponse } from 'next/server'
// import Stripe from 'stripe'

// TODO: Uncomment when Stripe is configured
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16',
// })

export async function POST() {
  // PLACEHOLDER: Stripe webhook handler
  // TODO: Configure Stripe and uncomment the implementation below
  
  console.log('Stripe webhook received (placeholder)')
  return NextResponse.json({ 
    message: 'Stripe webhook placeholder - configure Stripe to enable',
    received: true 
  })

  /* TODO: Uncomment when Stripe is configured
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
  }

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Extract metadata
        const userId = paymentIntent.metadata.user_id
        const plan = paymentIntent.metadata.plan
        
        if (!userId || !plan) {
          console.error('Missing user_id or plan in payment metadata')
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Reconcile payment
        await reconcilePayment({
          user_id: userId,
          provider: 'stripe',
          provider_payment_id: paymentIntent.id,
          amount_cents: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'completed',
          plan,
          valid_from: new Date().toISOString(),
          valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })

        console.log('Stripe payment processed:', paymentIntent.id)
        break

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent
        
        if (failedPayment.metadata.user_id) {
          await reconcilePayment({
            user_id: failedPayment.metadata.user_id,
            provider: 'stripe',
            provider_payment_id: failedPayment.id,
            amount_cents: failedPayment.amount,
            currency: failedPayment.currency,
            status: 'failed',
            plan: failedPayment.metadata.plan || 'unknown',
            valid_from: new Date().toISOString(),
            valid_to: new Date().toISOString(),
          })
        }

        console.log('Stripe payment failed:', failedPayment.id)
        break

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook error:', err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    )
  }
  */
}

// Razorpay webhook handler
export async function PUT() {
  // PLACEHOLDER: Razorpay webhook handler
  // TODO: Configure Razorpay and uncomment the implementation below
  
  console.log('Razorpay webhook received (placeholder)')
  return NextResponse.json({ 
    message: 'Razorpay webhook placeholder - configure Razorpay to enable',
    status: 'ok' 
  })

  /* TODO: Uncomment when Razorpay is configured
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
  }

  try {
    // Verify Razorpay webhook signature
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    // Handle Razorpay events
    switch (event.event) {
      case 'payment.captured':
        const payment = event.payload.payment.entity
        
        // Extract user info from notes
        const userId = payment.notes?.user_id
        const plan = payment.notes?.plan
        
        if (!userId || !plan) {
          console.error('Missing user_id or plan in payment notes')
          return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
        }

        await reconcilePayment({
          user_id: userId,
          provider: 'razorpay',
          provider_payment_id: payment.id,
          amount_cents: payment.amount, // Razorpay amounts are in paise (1/100 rupee)
          currency: payment.currency.toLowerCase(),
          status: 'completed',
          plan,
          valid_from: new Date().toISOString(),
          valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })

        console.log('Razorpay payment processed:', payment.id)
        break

      case 'payment.failed':
        const failedRzpPayment = event.payload.payment.entity
        
        if (failedRzpPayment.notes?.user_id) {
          await reconcilePayment({
            user_id: failedRzpPayment.notes.user_id,
            provider: 'razorpay',
            provider_payment_id: failedRzpPayment.id,
            amount_cents: failedRzpPayment.amount,
            currency: failedRzpPayment.currency.toLowerCase(),
            status: 'failed',
            plan: failedRzpPayment.notes?.plan || 'unknown',
            valid_from: new Date().toISOString(),
            valid_to: new Date().toISOString(),
          })
        }

        console.log('Razorpay payment failed:', failedRzpPayment.id)
        break

      default:
        console.log(`Unhandled Razorpay event: ${event.event}`)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Razorpay webhook error:', err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    )
  }
  */
}
