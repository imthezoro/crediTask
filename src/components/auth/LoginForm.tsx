import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Eye, EyeOff, Loader2, AlertCircle, Settings, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SupabaseConnectionTest } from '../debug/SupabaseConnectionTest';
import { getConnectionStatus, checkConfiguration } from '../../lib/supabase';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed' | 'misconfigured'>('unknown');
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();

  // Check connection status periodically
  useEffect(() => {
    const checkStatus = () => {
      const status = getConnectionStatus();
      const config = checkConfiguration();
      
      if (!config.isValid) {
        setConnectionStatus('misconfigured');
      } else {
        setConnectionStatus(status.status);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

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
    
    // Check configuration before attempting login
    const config = checkConfiguration();
    if (!config.isValid) {
      setError('Supabase is not properly configured. Please check your environment variables and restart the server.');
      setIsSubmitting(false);
      return;
    }
    
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
      
      // Provide more specific error messages based on the error
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('fetch')) {
          setError('Connection timeout. Please check your internet connection and try again.');
        } else if (error.message.includes('Invalid API key') || error.message.includes('PGRST301')) {
          setError('Authentication service error. Please check your Supabase configuration.');
        } else {
          setError('An error occurred during login. Please try again.');
        }
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string = 'password123') => {
    // Check configuration before attempting demo login
    const config = checkConfiguration();
    if (!config.isValid) {
      setError('Supabase is not properly configured. Please run diagnostics to check your configuration.');
      return;
    }

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
        setError('Demo login failed. The demo users may not exist yet. Try running diagnostics to create them.');
      }
    } catch (error) {
      console.error('LoginForm: Demo login error:', error);
      setError('Demo login failed. Try running diagnostics to check the connection and create demo users.');
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

  // Show diagnostics if requested
  if (showDiagnostics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <button
              onClick={() => setShowDiagnostics(false)}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ← Back to Login
            </button>
          </div>
          <SupabaseConnectionTest />
        </div>
      </div>
    );
  }

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: Wifi, color: 'text-green-600', text: 'Connected' };
      case 'failed':
        return { icon: WifiOff, color: 'text-red-600', text: 'Connection Failed' };
      case 'misconfigured':
        return { icon: Settings, color: 'text-yellow-600', text: 'Not Configured' };
      default:
        return { icon: Loader2, color: 'text-gray-400', text: 'Checking...' };
    }
  };

  const statusDisplay = getConnectionStatusDisplay();

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
          {/* Connection Status Indicator */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <statusDisplay.icon className={`h-4 w-4 ${statusDisplay.color} ${connectionStatus === 'unknown' ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700">Database Status</span>
              </div>
              <span className={`text-sm ${statusDisplay.color}`}>{statusDisplay.text}</span>
            </div>
            
            {connectionStatus === 'misconfigured' && (
              <div className="mt-2 text-xs text-yellow-700">
                Supabase configuration is missing or invalid. Click "Diagnostics" for help.
              </div>
            )}
            
            {connectionStatus === 'failed' && (
              <div className="mt-2 text-xs text-red-700">
                Unable to connect to database. Check your internet connection or run diagnostics.
              </div>
            )}
          </div>

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
                <div>
                  <span>{error}</span>
                  {(error.includes('Demo login failed') || error.includes('not properly configured') || error.includes('Connection timeout')) && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowDiagnostics(true)}
                        className="text-red-700 underline hover:text-red-800"
                      >
                        Run connection diagnostics
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot your password?
                </Link>
              </div>
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(true)}
                  className="font-medium text-gray-600 hover:text-gray-700 transition-colors flex items-center space-x-1"
                >
                  <Settings className="h-3 w-3" />
                  <span>Diagnostics</span>
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || connectionStatus === 'misconfigured'}
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
                disabled={isSubmitting || connectionStatus === 'misconfigured'}
                className="bg-blue-50 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                <div className="font-medium text-blue-900">Client Account</div>
                <div className="text-blue-700">sarah@example.com</div>
                <div className="text-blue-600 text-xs mt-1">Password: password123</div>
              </button>
              
              <button
                type="button"
                onClick={() => handleDemoLogin('alex@example.com')}
                disabled={isSubmitting || connectionStatus === 'misconfigured'}
                className="bg-green-50 hover:bg-green-100 border border-green-200 p-3 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                <div className="font-medium text-green-900">Worker Account</div>
                <div className="text-green-700">alex@example.com</div>
                <div className="text-green-600 text-xs mt-1">Password: password123</div>
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <strong>Having trouble?</strong> Click "Diagnostics" above to test your Supabase connection and create demo users if needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}