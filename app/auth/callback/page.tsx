"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!url || !anon) {
          throw new Error('Supabase URL or Anon Key is missing');
        }

        // Create a new Supabase client
        const supabase = createClient(url, anon, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: true,
          },
        });

        console.log('Starting OAuth callback with URL:', window.location.href);

        // Read optional post-login redirect
        const currentUrl = new URL(window.location.href);
        const errorParam = currentUrl.searchParams.get('error');
        const redirectTo = currentUrl.searchParams.get('redirectTo') || '/dashboard';

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        let data: any = null;
        let authError: any = null;
        let expiresSeconds: number = 3600;

        const hasHash = window.location.hash && window.location.hash.includes('access_token');
        const hasCode = currentUrl.searchParams.has('code');

        if (hasCode) {
          // PKCE flow
          const result = await supabase.auth.exchangeCodeForSession(window.location.href);
          data = result.data;
          authError = result.error;
        } else if (hasHash) {
          // Implicit flow: parse tokens from URL hash and set session if possible
          const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token') || '';
          const refresh_token = params.get('refresh_token') || '';
          const expires_in = Number(params.get('expires_in') || '3600');
          expiresSeconds = Number.isFinite(expires_in) && expires_in > 0 ? expires_in : 3600;

          if (!access_token) {
            throw new Error('Missing access_token in callback hash');
          }

          if (refresh_token) {
            const result = await supabase.auth.setSession({ access_token, refresh_token });
            authError = result.error;
            data = result.data;
          } else {
            // If no refresh token, we still proceed with an access-token-only session for our app
            data = { session: { access_token } };
          }

          // Clear the hash from the URL to avoid leaking tokens
          try {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          } catch (_) {
            // ignore
          }
        } else {
          throw new Error('Neither code nor access_token found in callback URL');
        }

        if (authError) {
          console.error('Exchange error:', authError);
          throw new Error(`Failed to complete OAuth: ${authError.message}`);
        }

        if (!data?.session) {
          throw new Error('No session data returned from Supabase');
        }

        console.log('Auth session data:', data);
        
        const access_token = data.session.access_token;
        const expires_in = expiresSeconds;
        
        // Validate the session contains user data before proceeding
        if (!data.session.user || !data.session.user.email) {
          throw new Error('Invalid session: missing user information');
        }

        // Store the access token in localStorage for client-side usage
        try {
          localStorage.setItem('sb-access-token', access_token);
          // Also set a cookie that our server-side can use
          const isHttps = window.location.protocol === 'https:';
          const secureAttr = isHttps ? '; secure' : '';
          document.cookie = `sb-access-token=${access_token}; path=/; max-age=${expires_in}; samesite=lax${secureAttr}`;
        } catch (e) {
          console.warn('Failed to store session:', e);
        }

        // Notify the extension about successful login
        // 1) If opened from another window, notify the opener
        if (window.opener) {
          window.opener.postMessage(
            { type: 'SUPABASE_AUTH', event: 'SIGNED_IN', session: data.session },
            window.location.origin
          );
        }
        // 2) Also notify the current window so content script on /auth/callback can forward to background
        window.postMessage(
          { type: 'SUPABASE_AUTH', event: 'SIGNED_IN', session: data.session },
          window.location.origin
        );

        setMessage('Signed in! Redirecting...');
        // Small delay so the content script on /auth/callback can forward token to extension
        setTimeout(() => {
          window.location.replace(redirectTo);
        }, 400);
        
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        console.error('Auth callback error:', e);
        setError(`Authentication failed: ${errorMessage}`);
        setMessage('Authentication failed');
      }
    };

    run();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>PromptOK</h1>
      <p>{message}</p>
    </main>
  );
}
