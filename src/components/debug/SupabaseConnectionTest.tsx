import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  Database, 
  Wifi, 
  User,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
  duration?: number;
}

export function SupabaseConnectionTest() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [envVars, setEnvVars] = useState({
    url: '',
    anonKey: '',
    urlValid: false,
    keyValid: false
  });

  useEffect(() => {
    checkEnvironmentVariables();
  }, []);

  const checkEnvironmentVariables = () => {
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    setEnvVars({
      url,
      anonKey,
      urlValid: url.startsWith('https://') && url.includes('.supabase.co'),
      keyValid: anonKey.length > 50 && anonKey.startsWith('eyJ')
    });
  };

  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        return prev.map(t => t.name === name ? { ...t, ...updates } : t);
      } else {
        return [...prev, { name, status: 'pending', message: '', ...updates }];
      }
    });
  };

  const runTest = async (name: string, testFn: () => Promise<{ success: boolean; message: string; details?: string }>) => {
    const startTime = Date.now();
    updateTest(name, { status: 'pending', message: 'Running...' });
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise<{ success: boolean; message: string; details?: string }>((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout after 10 seconds')), 10000)
        )
      ]);
      
      const duration = Date.now() - startTime;
      updateTest(name, {
        status: result.success ? 'success' : 'error',
        message: result.message,
        details: result.details,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(name, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests([]);

    // Test 1: Environment Variables
    await runTest('Environment Variables', async () => {
      if (!envVars.url || !envVars.anonKey) {
        return {
          success: false,
          message: 'Missing environment variables',
          details: `URL: ${envVars.url ? 'Present' : 'Missing'}, Key: ${envVars.anonKey ? 'Present' : 'Missing'}`
        };
      }
      
      if (!envVars.urlValid || !envVars.keyValid) {
        return {
          success: false,
          message: 'Invalid environment variables format',
          details: `URL Valid: ${envVars.urlValid}, Key Valid: ${envVars.keyValid}`
        };
      }

      return {
        success: true,
        message: 'Environment variables are properly configured'
      };
    });

    // Test 2: Basic Connection
    await runTest('Basic Connection', async () => {
      try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        
        if (error) {
          return {
            success: false,
            message: 'Database connection failed',
            details: error.message
          };
        }

        return {
          success: true,
          message: 'Successfully connected to Supabase database'
        };
      } catch (error) {
        return {
          success: false,
          message: 'Connection error',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 3: Auth Service
    await runTest('Auth Service', async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          return {
            success: false,
            message: 'Auth service error',
            details: error.message
          };
        }

        return {
          success: true,
          message: 'Auth service is working',
          details: `Session: ${data.session ? 'Active' : 'None'}`
        };
      } catch (error) {
        return {
          success: false,
          message: 'Auth service failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 4: Database Schema
    await runTest('Database Schema', async () => {
      try {
        const tables = ['users', 'projects', 'tasks', 'notifications'];
        const results = [];
        
        for (const table of tables) {
          const { error } = await supabase.from(table).select('*').limit(1);
          results.push({ table, exists: !error });
        }
        
        const missingTables = results.filter(r => !r.exists).map(r => r.table);
        
        if (missingTables.length > 0) {
          return {
            success: false,
            message: 'Missing database tables',
            details: `Missing: ${missingTables.join(', ')}`
          };
        }

        return {
          success: true,
          message: 'All required tables exist',
          details: `Checked: ${tables.join(', ')}`
        };
      } catch (error) {
        return {
          success: false,
          message: 'Schema check failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 5: Demo User Check
    await runTest('Demo Users', async () => {
      try {
        const { data: sarahUser, error: sarahError } = await supabase
          .from('users')
          .select('*')
          .eq('email', 'sarah@example.com')
          .limit(1);

        const { data: alexUser, error: alexError } = await supabase
          .from('users')
          .select('*')
          .eq('email', 'alex@example.com')
          .limit(1);

        const sarahExists = !sarahError && sarahUser && sarahUser.length > 0;
        const alexExists = !alexError && alexUser && alexUser.length > 0;

        if (!sarahExists && !alexExists) {
          return {
            success: false,
            message: 'Demo users not found',
            details: 'Neither sarah@example.com nor alex@example.com exist in the database'
          };
        }

        if (!sarahExists || !alexExists) {
          return {
            success: false,
            message: 'Some demo users missing',
            details: `Sarah: ${sarahExists ? 'Found' : 'Missing'}, Alex: ${alexExists ? 'Found' : 'Missing'}`
          };
        }

        return {
          success: true,
          message: 'Demo users found',
          details: 'Both demo accounts exist and are ready for login'
        };
      } catch (error) {
        return {
          success: false,
          message: 'Demo user check failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 6: Auth Login Test
    await runTest('Auth Login Test', async () => {
      try {
        // Try to sign out first to clear any existing session
        await supabase.auth.signOut();
        
        // Attempt login with demo credentials
        const { data, error } = await supabase.auth.signInWithPassword({
          email: 'sarah@example.com',
          password: 'password123'
        });

        if (error) {
          return {
            success: false,
            message: 'Demo login failed',
            details: error.message
          };
        }

        if (!data.user || !data.session) {
          return {
            success: false,
            message: 'Login succeeded but no user/session returned',
            details: `User: ${!!data.user}, Session: ${!!data.session}`
          };
        }

        // Sign out after test
        await supabase.auth.signOut();

        return {
          success: true,
          message: 'Demo login works correctly',
          details: 'Successfully logged in and out with demo credentials'
        };
      } catch (error) {
        return {
          success: false,
          message: 'Login test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    setIsRunning(false);
  };

  const createDemoUsers = async () => {
    setIsRunning(true);
    
    try {
      // Create Sarah (Client)
      const { data: sarahAuth, error: sarahAuthError } = await supabase.auth.signUp({
        email: 'sarah@example.com',
        password: 'password123',
        options: {
          data: { name: 'Sarah Johnson' }
        }
      });

      if (!sarahAuthError && sarahAuth.user) {
        await supabase.from('users').insert({
          id: sarahAuth.user.id,
          email: 'sarah@example.com',
          name: 'Sarah Johnson',
          role: 'client',
          rating: 4.8,
          wallet_balance: 5000,
          tier: null,
          onboarding_completed: true
        });
      }

      // Create Alex (Worker)
      const { data: alexAuth, error: alexAuthError } = await supabase.auth.signUp({
        email: 'alex@example.com',
        password: 'password123',
        options: {
          data: { name: 'Alex Smith' }
        }
      });

      if (!alexAuthError && alexAuth.user) {
        await supabase.from('users').insert({
          id: alexAuth.user.id,
          email: 'alex@example.com',
          name: 'Alex Smith',
          role: 'worker',
          rating: 4.9,
          wallet_balance: 1250,
          skills: ['React', 'Node.js', 'TypeScript', 'Python'],
          tier: 'silver',
          onboarding_completed: true
        });
      }

      // Sign out after creating users
      await supabase.auth.signOut();
      
      alert('Demo users created successfully! You can now run the tests again.');
    } catch (error) {
      console.error('Error creating demo users:', error);
      alert('Error creating demo users. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'pending': return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Supabase Connection Diagnostics</h2>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{showDetails ? 'Hide' : 'Show'} Details</span>
            </button>
            
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Run Tests</span>
            </button>
          </div>
        </div>

        {/* Environment Variables Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Environment Variables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              {envVars.urlValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>VITE_SUPABASE_URL: {envVars.url ? 'Present' : 'Missing'}</span>
            </div>
            <div className="flex items-center space-x-2">
              {envVars.keyValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>VITE_SUPABASE_ANON_KEY: {envVars.anonKey ? 'Present' : 'Missing'}</span>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          {tests.map((test) => (
            <div key={test.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <h4 className="font-medium text-gray-900">{test.name}</h4>
                    <p className="text-sm text-gray-600">{test.message}</p>
                  </div>
                </div>
                
                {test.duration && (
                  <span className="text-xs text-gray-500">{test.duration}ms</span>
                )}
              </div>
              
              {showDetails && test.details && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
                  <strong>Details:</strong> {test.details}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        {tests.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={createDemoUsers}
                disabled={isRunning}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <User className="h-4 w-4" />
                <span>Create Demo Users</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}