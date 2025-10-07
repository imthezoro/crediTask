import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
// Limits are now sourced from the database column user_profiles.prompt_limit
import InterestSignup from '@/components/InterestSignup'
import ApiAccessSignup from '@/components/ApiAccessSignup'

// User billing is personalized content
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = await createClient()
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  // Get user profile with optimized query (select only needed fields)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan, usage_count, plan_valid_until, is_active, is_guest, prompt_limit')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.is_active) {
    redirect('/auth/signin?error=Account is not active')
  }

  // Effective limit displayed from profile.prompt_limit; null means unlimited (∞)
  const effectiveLimit = (profile?.prompt_limit ?? null)

  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: '/week',
      features: [`${profile?.prompt_limit ?? '∞'} enhancements/week`, 'Basic analytics', 'Community support'],
      current: profile?.plan === 'free' || !profile?.plan
    },
    {
      name: 'Pro Weekly',
      price: '₹250',
      period: '/week',
      features: ['Unlimited enhancements/week', 'Advanced analytics', 'Priority support', 'Custom templates', 'API access'],
      current: profile?.plan === 'pro_weekly'
    },
    {
      name: 'Pro Monthly',
      price: '₹900',
      period: '/month',
      features: ['Unlimited enhancements/month', 'Advanced analytics', 'Priority support', 'Custom templates', 'API access', 'Best value - Save 10%'],
      current: profile?.plan === 'pro_monthly'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Billing" />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Current Plan */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 capitalize">{profile?.plan || 'Free'}</p>
              <p className="text-gray-600">
                {profile?.plan_valid_until 
                  ? `Valid until ${new Date(profile.plan_valid_until).toLocaleDateString()}`
                  : 'No expiration'
                }
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Usage</p>
              <p className="text-2xl font-semibold text-gray-900">
                {profile?.usage_count || 0} / {effectiveLimit ?? '∞'}
              </p>
              <p className="text-xs text-gray-400">{effectiveLimit === null ? 'Unlimited' : 'Limit'}</p>
            </div>
          </div>
        </div>

        {/* Available Plans */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Plans</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-lg shadow p-6 ${
                  plan.current ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    plan.current
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            ))}

            {/* More Credits Signup */}
            <InterestSignup />
          </div>
        </div>

        {/* API Access */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">API Access</h2>
          <p className="text-gray-600 mb-4">API access is under construction.</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">Join the API waitlist</h3>
            <ApiAccessSignup />
          </div>
        </div>

        {/* Payment History - Commented out for now as we're not taking payments */}
      </div>
    </div>
  )
}

