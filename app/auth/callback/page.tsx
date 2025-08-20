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
        
        // Let Supabase handle the session from URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw new Error(`Session error: ${error.message}`);
        }

        if (!data.session) {
          // Check if we have auth code in URL for PKCE flow
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

        // Get final session after potential code exchange
        const { data: finalData } = await supabase.auth.getSession();
        const session = finalData.session;
        
        if (session) {
          // Store auth data and notify extension using auth service
          authService.storeAuthData(session);
          authService.notifyExtension('SIGNED_IN', session);
        }

        setMessage('Signed in! Redirecting...');
        
        // Redirect to dashboard
        const redirectTo = urlParams.get('redirectTo') || '/dashboard';
        setTimeout(() => {
          window.location.replace(redirectTo);
        }, 1000);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        console.error('Auth callback error:', err);
        setError(errorMessage);
        setMessage('Authentication failed');
        
        // Redirect to signin with error
        setTimeout(() => {
          window.location.replace(`/auth/signin?error=${encodeURIComponent(errorMessage)}`);
        }, 3000);
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
