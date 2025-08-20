"use client";

import { useEffect, useState } from 'react';
import { authService } from '@/lib/auth-service';

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        // Get Supabase client from auth service
        const supabase = (authService as any).supabase;

        // 1) Handle hash-based token response (implicit flow or provider quirk)
        // Example: #access_token=...&refresh_token=...&expires_in=...
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            // Set session directly from tokens
            const { data: setData, error: setError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (setError) {
              throw new Error(`Set session failed: ${setError.message}`);
            }

            // Clean hash from URL to avoid leaking tokens
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }
        }
        
        // 2) Let Supabase handle the session from URL/cookies if already present
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw new Error(`Session error: ${error.message}`);
        }

        if (!data.session) {
          // 3) PKCE code exchange path
          const code = urlParams.get('code');
          
          if (code) {
            // Exchange code for session
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (exchangeError) {
              throw new Error(`Code exchange failed: ${exchangeError.message}`);
            }
          } else {
            throw new Error('No valid session or auth code found');
          }
        }

        // Get final session after potential code/hash handling
        const { data: finalData } = await supabase.auth.getSession();
        const session = finalData.session;
        
        if (session) {
          // Store auth data and notify extension using auth service
          authService.storeAuthData(session);
          authService.notifyExtension('SIGNED_IN', session);
        }

        setMessage('Signed in! Redirecting...');
        
        // Redirect to dashboard or provided redirectTo
        const redirectTo = urlParams.get('redirectTo') || '/dashboard';
        setTimeout(() => {
          window.location.replace(redirectTo);
        }, 500);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        console.error('Auth callback error:', err);
        setError(errorMessage);
        setMessage('Authentication failed');
        
        // Redirect to signin with error
        setTimeout(() => {
          window.location.replace(`/auth/signin?error=${encodeURIComponent(errorMessage)}`);
        }, 1500);
      }
    };

    handleCallback();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">PromptOK</h1>
        <p className="text-gray-600 mb-4">{message}</p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </main>
  );
}
