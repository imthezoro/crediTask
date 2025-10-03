import Header from '@/components/Header'
import PricingClient from '@/components/PricingClient'

// Static pricing page with client-side personalization
export const dynamic = 'force-static'
export const revalidate = 86400 // 24 hours - pricing rarely changes

export const metadata = {
  title: 'Pricing | PromptOK',
  description: 'Simple, transparent pricing for PromptOK. Choose the plan that fits your needs with our 14-day free trial.',
  keywords: 'pricing, plans, subscription, free trial, pro weekly, pro monthly'
}

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: '/week',
      features: [
        '10 prompt enhancements/week',
        'Basic analytics',
        'Chrome extension access',
        'Community support'
      ],
      popular: false
    },
    {
      name: 'Pro Weekly',
      price: '₹250',
      period: '/week',
      features: [
        'Unlimited prompt enhancements',
        'Advanced analytics',
        'Priority support',
        'Custom templates',
        'API access'
      ],
      popular: true
    },
    {
      name: 'Pro Monthly',
      price: '₹900',
      period: '/month',
      features: [
        'Unlimited prompt enhancements',
        'Advanced analytics',
        'Priority support',
        'Custom templates',
        'API access',
        'Best value - Save 10%'
      ],
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header pageTitle="Pricing" />
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Choose the plan that fits your needs
          </p>
        </div>

        <PricingClient plans={plans} />
      </div>
    </div>
  )
}
