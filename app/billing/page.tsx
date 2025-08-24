import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InterestSignup from '@/components/InterestSignup'
import { FREE_PLAN_LIMIT, GUEST_QUOTA } from '@/lib/rateLimit'

async function getUserAndPayments() {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  
  if (!accessToken) {
    redirect('/auth/signin')
  }

  const supabase = createServerClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) {
      redirect('/auth/signin')
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Payments intentionally unused for now, but kept for future use
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return { user, profile, payments: payments || [] }
  } catch (error) {
    console.error('Billing page error:', error)
    redirect('/auth/signin')
  }
}

export default async function BillingPage() {
  const { user, profile } = await getUserAndPayments()

  // Determine the effective limit for free/guest users based on centralized quotas
  const freeLimit = (profile?.is_guest ? GUEST_QUOTA : FREE_PLAN_LIMIT)

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/week',
      features: [`${FREE_PLAN_LIMIT} enhancements/week`, 'Basic analytics', 'Community support'],
      current: profile?.plan === 'free' || !profile?.plan
    },
    // Commented out for now - will be needed later
    // {
    //   name: 'Pro',
    //   price: '$19',
    //   period: '/month',
    //   features: ['1,000 enhancements/month', 'Advanced analytics', 'Priority support', 'API access'],
    //   current: profile?.plan === 'pro'
    // },
    // {
    //   name: 'Enterprise',
    //   price: '$99',
    //   period: '/month',
    //   features: ['Unlimited enhancements', 'Team management', 'Custom integrations', 'SLA'],
    //   current: profile?.plan === 'enterprise'
    // }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
            <nav className="space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
              <Link href="/settings" className="text-blue-600 hover:text-blue-700">Settings</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
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
              <p className="text-sm text-gray-500">Usage this week</p>
              <p className="text-2xl font-semibold text-gray-900">
                {profile?.usage_count || 0} / {(profile?.plan === 'free' || !profile?.plan) ? freeLimit : '∞'}
              </p>
              <p className="text-xs text-gray-400">Weekly limit</p>
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

        {/* Payment History - Commented out for now as we're not taking payments */}
      </div>
    </div>
  )
}

