'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AuthService } from '@/lib/auth-service'
import type { User } from '@supabase/supabase-js'

interface Plan {
  name: string
  price: string
  period: string
  features: string[]
  popular: boolean
}

interface PricingClientProps {
  plans: Plan[]
}

export default function PricingClient({ plans }: PricingClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const authService = new AuthService()
        const user = await authService.getCurrentUser()
        setUser(user || null)
      } catch (error) {
        console.error('Error checking user session:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  const getPlanCTA = (plan: Plan) => {
    if (loading) return 'Loading...'
    
    if (user) {
      if (plan.name === 'Free') return 'Current Plan'
      if (plan.name === 'Pro') return 'Upgrade to Pro'
      if (plan.name === 'Enterprise') return 'Contact Sales'
    }
    
    return `Sign Up for ${plan.name}`
  }

  const getPlanHref = (plan: Plan) => {
    if (loading) return '#'
    
    if (user) {
      if (plan.name === 'Free') return '/dashboard'
      return '/billing'
    }
    
    return '/auth/signup'
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`bg-white rounded-lg shadow-lg p-8 relative ${
              plan.popular ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 ml-1">{plan.period}</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={getPlanHref(plan)}
              className={`w-full block text-center py-3 px-4 rounded-lg font-semibold transition-colors ${
                plan.popular
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {getPlanCTA(plan)}
            </Link>
          </div>
        ))}
      </div>

      <div className="text-center mt-16">
        <p className="text-gray-600 mb-4">
          All plans include a 14-day free trial. No credit card required.
        </p>
        {!loading && user ? (
          <div className="space-x-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              Go to Dashboard →
            </Link>
            <Link href="/billing" className="text-blue-600 hover:text-blue-700 font-medium">
              Manage Billing →
            </Link>
          </div>
        ) : (
          <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
            Start your free trial →
          </Link>
        )}
      </div>
    </>
  )
}
