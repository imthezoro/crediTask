import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">PromptOK</Link>
            <div className="space-x-4">
              <Link href="/pricing" className="text-gray-600 hover:text-blue-600">Pricing</Link>
              <Link href="/status" className="text-gray-600 hover:text-blue-600">Status</Link>
              <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">Sign In</Link>
              <Link href="/auth/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            PromptOK
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Enhance your AI prompts with intelligent suggestions and optimization
          </p>
          <div className="space-x-4">
            <Link 
              href="/auth/signup" 
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </Link>
            <Link 
              href="/pricing" 
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </header>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Smart Enhancement</h3>
            <p className="text-gray-600">AI-powered prompt optimization for better results</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Chrome Extension</h3>
            <p className="text-gray-600">Seamless integration with your favorite AI tools</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Analytics</h3>
            <p className="text-gray-600">Track your prompt performance and improvements</p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to enhance your prompts?
          </h2>
          <p className="text-gray-600 mb-8">
            Join thousands of users improving their AI interactions
          </p>
          <Link 
            href="/auth/signup" 
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Free Trial
          </Link>
        </section>
      </div>
    </div>
  )
}


