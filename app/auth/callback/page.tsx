"use client";

import { useEffect, useState } from 'react';
import { authService } from '@/lib/auth-service';

interface CallbackState {
  message: string;
  error: string | null;
  isProcessing: boolean;
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>({
    message: 'Completing sign-in...',
    error: null,
    isProcessing: true
  });

  const updateState = (updates: Partial<CallbackState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const processAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        
        // Check for OAuth error in URL
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        const supabase = authService.getSupabaseClient();
        let session = null;

        // Handle hash-based tokens (implicit flow)
        if (window.location.hash?.includes('access_token')) {
          session = await handleHashTokens(supabase);
        }
        
        // Handle code-based flow (PKCE)
        if (!session) {
          session = await handleCodeExchange(supabase, urlParams);
        }
        
        // Verify we have a valid session
        if (!session) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session) {
          throw new Error('No valid session created');
        }

        // Store session and notify extension
        authService.storeAuthData(session);
        authService.notifyExtension('SIGNED_IN', session);

        updateState({ 
          message: 'Signed in! Redirecting...', 
          isProcessing: false 
        });
        
        // Redirect to destination
        const redirectTo = urlParams.get('redirectTo') || '/dashboard';
        setTimeout(() => {
          window.location.replace(redirectTo);
        }, 500);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        console.error('Auth callback error:', error);
        
        updateState({
          error: errorMessage,
          message: 'Authentication failed',
          isProcessing: false
        });
        
        // Redirect to signin with error after delay
        setTimeout(() => {
          window.location.replace(`/auth/signin?error=${encodeURIComponent(errorMessage)}`);
        }, 2000);
      }
    };

    processAuthCallback();
  }, []);

  // Handle hash-based token authentication
  const handleHashTokens = async (supabase: any) => {
    const hash = window.location.hash;
    if (!hash) return null;

    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      throw new Error('Missing required tokens in hash');
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(`Set session failed: ${error.message}`);
    }

    // Clean URL to remove sensitive tokens
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.search
    );

    return data.session;
  };

  // Handle PKCE code exchange
  const handleCodeExchange = async (supabase: any, urlParams: URLSearchParams) => {
    const code = urlParams.get('code');
    if (!code) return null;

    const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
    if (error) {
      throw new Error(`Code exchange failed: ${error.message}`);
    }

    const { data } = await supabase.auth.getSession();
    return data.session;
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">PromptOK</h1>
          
          {state.isProcessing && (
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Processing...</span>
            </div>
          )}
          
          <p className="text-gray-600 mb-4">{state.message}</p>
          
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-left" role="alert">
              <strong>Error:</strong> {state.error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
