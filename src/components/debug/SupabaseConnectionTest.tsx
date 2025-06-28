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
  EyeOff,
  ExternalLink,
  AlertCircle,
  Settings,
  Activity,
  Clock
} from 'lucide-react';
import { supabase, testSupabaseConnection, getConnectionStatus, checkConfiguration } from '../../lib/supabase';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning' | 'skipped';
  message: string;
  details?: string;
  duration?: number;
}

export function SupabaseConnectionTest() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(getConnectionStatus());
  const [envVars, setEnvVars] = useState({
    url: '',
    anonKey: '',
    urlValid: false,
    keyValid: false,
    isConfigured: false
  });

  useEffect(() => {
    checkEnvironmentVariables();
    
    // Update connection info every 5 seconds
    const interval = setInterval(() => {
      setConnectionInfo(getConnectionStatus());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const checkEnvironmentVariables = () => {
    const config = checkConfiguration();
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    setEnvVars({
      url,
      anonKey,
      urlValid: config.urlValid,
      keyValid: config.keyValid,
      isConfigured: config.isValid
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

  const runTest = async (name: string, testFn: () => Promise<{ success: boolean; message: string; details?: string }>, timeoutMs: number = 8000) => {
    const startTime = Date.now();
    updateTest(name, { status: 'pending', message: 'Running...' });
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise<{ success: boolean; message: string; details?: string }>((_, reject) => 
          setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
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
      const config = checkConfiguration();
      
      if (!config.hasUrl || !config.hasKey) {
        return {
          success: false,
          message: 'Missing environment variables',
          details: `URL: ${config.hasUrl ? 'Present' : 'Missing'}, Key: ${config.hasKey ? 'Present' : 'Missing'}`
        };
      } 
      
      if (!config.urlValid || !config.keyValid) {
        return {
          success: false,
          message: 'Invalid environment variables format',
          details: `URL Valid: ${config.urlValid}, Key Valid: ${config.keyValid}`
        };
      } 

      return { 
        success: true,
        message: 'Environment variables are properly configured'
      };
    }, 1000);

    // Only run connection tests if configuration is valid
    if (envVars.isConfigured) {
      // Test 2: Basic Connection
      await runTest('Basic Connection', async () => {
        try {
          const success = await testSupabaseConnection(8000);
          
          if (!success) {
            const status = getConnectionStatus();
            return {
              success: false,
              message: 'Failed to connect to Supabase',
              details: status.lastError || 'Check console for detailed error information'
            };
          }

          return {
            success: true,
            message: 'Successfully connected to Supabase'
          };
        } catch (error) {
          return {
            success: false,
            message: 'Connection error',
            details: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }, 10000);

      // Test 3: Database Query
      await runTest('Database Query', async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
          
          if (error) {
            return {
              success: false,
              message: 'Database query failed',
              details: error.message
            };
          }

          return {
            success: true,
            message: 'Database queries are working',
            details: 'User table query successful'
          };
        } catch (error) {
          return {
            success: false,
            message: 'Query execution failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }, 8000);

      // Test 4: Auth Service
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
      }, 8000);

      // Test 5: Database Schema
      const connectionStatus = getConnectionStatus();
      if (connectionStatus.status === 'connected') {
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
        }, 10000);

        // Test 6: Demo User Check
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
        }, 8000);
      }
    } else {
      // Skip connection tests if configuration is invalid
      updateTest('Basic Connection', {
        status: 'skipped',
        message: 'Skipped due to invalid configuration'
      });
      updateTest('Database Query', {
        status: 'skipped',
        message: 'Skipped due to invalid configuration'
      });
      updateTest('Auth Service', {
        status: 'skipped',
        message: 'Skipped due to invalid configuration'
      });
      updateTest('Database Schema', {
        status: 'skipped',
        message: 'Skipped due to invalid configuration'
      });
      updateTest('Demo Users', {
        status: 'skipped',
        message: 'Skipped due to invalid configuration'
      });
    }

    setIsRunning(false);
  };

  const createDemoUsers = async () => {
    if (!envVars.isConfigured) {
      alert('Please configure your Supabase environment variables first.');
      return;
    }

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
      case 'skipped': return <Settings className="h-5 w-5 text-gray-400" />;
    }
  };

  const hasConnectionIssues = !envVars.urlValid || !envVars.keyValid;

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

        {/* Real-time Connection Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Real-time Connection Status</h3>
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Last check: {connectionInfo.lastCheck ? new Date(connectionInfo.lastCheck).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              {connectionInfo.status === 'connected' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : connectionInfo.status === 'failed' ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : connectionInfo.status === 'misconfigured' ? (
                <Settings className="h-4 w-4 text-yellow-600" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span>Status: {connectionInfo.status}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Attempts: {connectionInfo.attempts}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Configured: {connectionInfo.isConfigured ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          {connectionInfo.lastError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Last Error:</strong> {connectionInfo.lastError}
            </div>
          )}
        </div>

        {/* Configuration Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Configuration Status</h3>
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
          
          <div className="mt-3 flex items-center space-x-2">
            {envVars.isConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="font-medium">
              Overall Configuration: {envVars.isConfigured ? 'Valid' : 'Invalid'}
            </span>
          </div>
          
          {showDetails && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              <div>URL: {envVars.url || 'Not set'}</div>
              <div>Key: {envVars.anonKey ? `${envVars.anonKey.substring(0, 20)}...` : 'Not set'}</div>
            </div>
          )}
        </div>

        {/* Troubleshooting Guide */}
        {hasConnectionIssues && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 mb-2">Configuration Issues Detected</h3>
                <div className="text-sm text-red-700 space-y-2">
                  <p>To fix connection issues, please verify your Supabase configuration:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center">Supabase Dashboard <ExternalLink className="h-3 w-3 ml-1" /></a></li>
                    <li>Select your project and go to Settings → API</li>
                    <li>Copy the "Project URL" and "Project API key (anon public)"</li>
                    <li>Create or update your .env file with these values:</li>
                  </ol>
                  <div className="mt-2 p-3 bg-red-100 rounded text-xs font-mono">
                    VITE_SUPABASE_URL=https://your-project.supabase.co<br/>
                    VITE_SUPABASE_ANON_KEY=your-anon-key-here
                  </div>
                  <p className="mt-2">After updating the .env file, restart your development server.</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                disabled={isRunning || !envVars.isConfigured}
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
              
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open Supabase Dashboard</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}