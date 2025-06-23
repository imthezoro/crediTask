import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (user && !isLoading) {
      console.log('LoginForm: User already logged in, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    console.log('LoginForm: Attempting login for:', email);
    
    try {
      const success = await login(email, password);
      if (success) {
        console.log('LoginForm: Login successful, will redirect via auth state change');
        // Fallback: If user is not redirected after 1s, force redirect
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            navigate('/dashboard', { replace: true });
          }
        }, 1000);
      } else {
        console.log('LoginForm: Login failed');
        setError('Invalid email or password. Please check your credentials and try again.');
      }
    } catch (error) {
      console.error('LoginForm: Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string = 'password123') => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setIsSubmitting(true);
    
    try {
      const success = await login(demoEmail, demoPassword);
      if (success) {
        console.log('LoginForm: Demo login successful');
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            navigate('/dashboard', { replace: true });
          }
        }, 1000);
      } else {
        setError('Demo login failed. Please try manual login.');
      }
    } catch (error) {
      console.error('LoginForm: Demo login error:', error);
      setError('Demo login failed. Please try manual login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking if user is already authenticated
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-amber-50 px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-amber-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Briefcase className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your FreelanceFlow account
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:z-10 sm:text-sm transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:z-10 sm:text-sm transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start space-x-3 text-red-600 text-sm bg-red-50 py-3 px-4 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  Sign up
                </Link>
              </span>
            </div>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-4">Demo Credentials (Click to auto-fill):</p>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <button
                type="button"
                onClick={() => handleDemoLogin('sarah@example.com')}
                disabled={isSubmitting}
                className="bg-blue-50 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                <div className="font-medium text-blue-900">Client Account</div>
                <div className="text-blue-700">sarah@example.com</div>
                <div className="text-blue-600 text-xs mt-1">Password: password123</div>
              </button>
              
              <button
                type="button"
                onClick={() => handleDemoLogin('alex@example.com')}
                disabled={isSubmitting}
                className="bg-green-50 hover:bg-green-100 border border-green-200 p-3 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                <div className="font-medium text-green-900">Worker Account</div>
                <div className="text-green-700">alex@example.com</div>
                <div className="text-green-600 text-xs mt-1">Password: password123</div>
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> If demo login doesn't work, the demo users may need to be created. 
                Try signing up with these credentials first, or contact support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}