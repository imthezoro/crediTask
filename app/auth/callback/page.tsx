"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';

interface CallbackState {
  message: string;
  error: string | null;
  isProcessing: boolean;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const processedRef = useRef(false); // prevent double-processing in StrictMode
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
      if (processedRef.current) return;
      processedRef.current = true;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const supabase = authService.getSupabaseClient();
        let session = null;

        // PRIORITY: Process tokens first, ignore error params if tokens are present
        // Handle hash-based tokens (implicit flow)
        if (window.location.hash?.includes('access_token')) {
          session = await handleHashTokens(supabase);
        }
        
        // Handle code-based flow (PKCE)
        if (!session) {
          session = await handleCodeExchange(supabase, urlParams);
        }
        
        // Only check for OAuth error if no tokens were processed
        if (!session) {
          const errorParam = urlParams.get('error');
          if (errorParam) {
            throw new Error(`OAuth error: ${errorParam}`);
          }
        }
        
        // Verify we have a valid session
        if (!session) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session) {
          throw new Error('No valid session created');
        }

        // Validate session and check if account is active
        const accessToken = session?.access_token
        const validateResponse = await fetch('/api/auth/validate-session', {
          method: 'POST',
          credentials: 'include',
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : undefined
        });

        const validateData = await validateResponse.json();

        if (!validateData.valid) {
          // Sign out the user immediately to clean up the session
          await supabase.auth.signOut();
          
          if (validateData.reason === 'deactivated') {
            // Set a flag so the signin page knows to skip processing hash tokens
            try { sessionStorage.setItem('promptok-skip-oauth-hash-once', '1') } catch {}
            throw new Error(validateData.message || 'This account has been deactivated. Please create a new account to continue.');
          } else {
            throw new Error('Session validation failed');
          }
        }

        // Store session and notify extension
        authService.storeAuthData(session);
        authService.notifyExtension('SIGNED_IN', session);

        updateState({ 
          message: 'Signed in! Redirecting...', 
          isProcessing: false 
        });
        
        // Redirect to destination (immediately)
        const redirectToRaw = urlParams.get('redirectTo') || '/dashboard';
        const redirectTo = sanitizeRedirect(redirectToRaw);
        router.replace(redirectTo);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Auth callback error:', error);
        }
        
        updateState({
          error: errorMessage,
          message: 'Authentication failed',
          isProcessing: false
        });
        
        // Redirect to signin with error (immediately)
        router.replace(`/auth/signin?error=${encodeURIComponent(errorMessage)}`);
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
      window.location.pathname // drop search too; callback page doesn't need it after processing
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

    // Clean the URL to remove code/state
    window.history.replaceState({}, document.title, window.location.pathname);
    return data.session;
  };

  // Ensure redirectTo is safe and within the app
  const sanitizeRedirect = (target: string): string => {
    try {
      if (!target || typeof target !== 'string') return '/dashboard';
      // Only allow same-origin paths
      if (target.startsWith('http://') || target.startsWith('https://')) return '/dashboard';
      if (!target.startsWith('/')) return '/dashboard';
      // Avoid redirecting back to callback repeatedly
      if (target.startsWith('/auth/callback')) return '/dashboard';
      return target || '/dashboard';
    } catch {
      return '/dashboard';
    }
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
