import { NextRequest, NextResponse } from 'next/server'
import { reconcilePayment } from '@/lib/payments'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!
    
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.payment_status === 'paid') {
          const paymentData = {
            provider: 'stripe' as const,
            provider_payment_id: session.payment_intent as string,
            amount_cents: session.amount_total || 0,
            currency: session.currency || 'usd',
            status: 'completed' as const,
            plan: session.metadata?.plan as 'free' | 'pro' | 'enterprise' || 'pro',
            valid_from: new Date().toISOString(),
            valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            user_id: session.metadata?.user_id || ''
          }

          await reconcilePayment(paymentData)
        }
        break

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        
        const paymentData = {
          provider: 'stripe' as const,
          provider_payment_id: invoice.payment_intent as string,
          amount_cents: invoice.amount_paid || 0,
          currency: invoice.currency || 'usd',
          status: 'completed' as const,
          plan: invoice.metadata?.plan as 'free' | 'pro' | 'enterprise' || 'pro',
          valid_from: new Date().toISOString(),
          valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          user_id: invoice.metadata?.user_id || ''
        }

        await reconcilePayment(paymentData)
        break

      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object)
        break

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// Handle Razorpay webhooks (if needed)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const signature = request.headers.get('x-razorpay-signature')

    // Verify Razorpay signature
    // Implementation depends on Razorpay SDK

    if (body.event === 'payment.captured') {
      const payment = body.payload.payment.entity
      
      const paymentData = {
        provider: 'razorpay' as const,
        provider_payment_id: payment.id,
        amount_cents: payment.amount,
        currency: payment.currency.toLowerCase(),
        status: 'completed' as const,
        plan: payment.notes?.plan as 'free' | 'pro' | 'enterprise' || 'pro',
        valid_from: new Date().toISOString(),
        valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        user_id: payment.notes?.user_id || ''
      }

      await reconcilePayment(paymentData)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Razorpay webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
