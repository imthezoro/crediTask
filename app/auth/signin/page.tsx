import { LoginForm } from '@/components/auth/login-form'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PromptOK</h1>
          <p className="text-gray-600">Welcome back</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
