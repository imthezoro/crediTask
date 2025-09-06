// Route Segment Options
export const revalidate = 86400; // 24h - privacy policy changes infrequently
export const dynamic = 'force-static';

export const metadata = {
  title: 'Privacy Policy | PromptOK',
  description: 'Privacy Policy for PromptOK. Learn how we collect, use, and protect your personal information.',
  keywords: 'privacy policy, data protection, personal information, GDPR, security'
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Account information (email, password)</li>
              <li>Usage data and analytics</li>
              <li>Prompt enhancement requests and results</li>
              <li>Payment information (processed securely through third parties)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Provide and improve our services</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send important updates and notifications</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All data is encrypted in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use trusted third-party services to provide our functionality:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Supabase for database and authentication</li>
              <li>OpenAI for AI processing</li>
              <li>Stripe for payment processing</li>
              <li>Vercel for hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at privacy@promptok.com
            </p>
          </section>

          <div className="border-t pt-8 text-sm text-gray-500">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a 
              href="/"
              className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Back to Home
            </a>
            <a 
              href="/auth/signin"
              className="inline-flex h-10 items-center rounded-md border border-blue-600 bg-white px-4 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </a>
            <a 
              href="/auth/signup"
              className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
