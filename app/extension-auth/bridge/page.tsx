'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

/**
 * Extension Auth Bridge Page
 * Provides secure JWT tokens to the extension via postMessage
 * Follows PromptOK coding patterns: 2-space indentation, proper error handling
 */
export default function ExtensionAuthBridge() {
  useEffect(() => {
    // Create a Supabase client in the effect scope for auth state subscription
    const supabaseForEvents = createClient();
    const handleAuthBridge = async () => {
      try {
        // Get parent origin from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const parentOrigin = urlParams.get('parentOrigin');
        
        if (!parentOrigin || !parentOrigin.startsWith('chrome-extension://')) {
          console.error('[Extension Bridge] Invalid parent origin:', parentOrigin);
          return;
        }

        console.log('[Extension Bridge] Initializing for origin:', parentOrigin);

        // Initialize Supabase client
        const supabase = createClient();
        
        // Check authentication status
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Extension Bridge] Auth error:', error);
          sendTokenMessage(parentOrigin, { 
            loggedIn: false, 
            error: error.message 
          });
          return;
        }

        if (!session || !session.user) {
          console.log('[Extension Bridge] No active session');
          sendTokenMessage(parentOrigin, { loggedIn: false });
          return;
        }

        // Get user profile to validate account status
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, is_active, deleted_at')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.error('[Extension Bridge] Profile error:', profileError);
          sendTokenMessage(parentOrigin, { 
            loggedIn: false, 
            error: 'Profile not found' 
          });
          return;
        }

        // Check if account is active
        if (!profile.is_active || profile.deleted_at) {
          console.log('[Extension Bridge] Account is deactivated');
          sendTokenMessage(parentOrigin, { loggedIn: false });
          return;
        }

        // Create Extension JWT using the session token
        const response = await fetch('/api/extension-token', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Token request failed' }));
          console.error('[Extension Bridge] Token request failed:', errorData);
          sendTokenMessage(parentOrigin, { 
            loggedIn: false, 
            error: errorData.error || 'Token request failed' 
          });
          return;
        }

        const tokenData = await response.json();
        
        if (tokenData.jwt && tokenData.expiresAt > Date.now()) {
          console.log('[Extension Bridge] Sending valid JWT to extension');
          sendTokenMessage(parentOrigin, {
            loggedIn: true,
            jwt: tokenData.jwt,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
            iss: tokenData.iss,
            aud: tokenData.aud,
            sub: tokenData.sub,
            iat: tokenData.iat,
            exp: tokenData.exp,
            jti: tokenData.jti,
            token_version: tokenData.token_version
          });
        } else {
          console.log('[Extension Bridge] No valid JWT available');
          sendTokenMessage(parentOrigin, { loggedIn: false });
        }

      } catch (error) {
        console.error('[Extension Bridge] Unexpected error:', error);
        const urlParams = new URLSearchParams(window.location.search);
        const parentOrigin = urlParams.get('parentOrigin');
        if (parentOrigin) {
          sendTokenMessage(parentOrigin, { 
            loggedIn: false, 
            error: 'Bridge initialization failed' 
          });
        }
      }
    };

    // Send token message to extension
    type ExtensionTokenPayload =
      | { loggedIn: false; error?: string }
      | {
          loggedIn: true;
          jwt: string;
          expiresAt: number;
          scope: string[];
          iss: string;
          aud: string;
          sub: string;
          iat: number;
          exp: number;
          jti: string;
          token_version: number;
        };

    const sendTokenMessage = (parentOrigin: string, payload: ExtensionTokenPayload) => {
      try {
        window.parent.postMessage({
          type: 'PROMPTOK_EXTENSION_TOKEN',
          payload
        }, parentOrigin);
        console.log('[Extension Bridge] Token message sent to extension');
      } catch (error) {
        console.error('[Extension Bridge] Failed to send message:', error);
      }
    };

    // Initialize bridge
    handleAuthBridge();

    // Listen for refresh requests from extension
    const handleMessage = (event: MessageEvent) => {
      const urlParams = new URLSearchParams(window.location.search);
      const parentOrigin = urlParams.get('parentOrigin');
      
      if (event.origin !== parentOrigin) {
        return;
      }

      if (event.data?.type === 'PROMPTOK_REFRESH_TOKEN') {
        console.log('[Extension Bridge] Refresh token requested');
        handleAuthBridge();
      }
    };

    window.addEventListener('message', handleMessage);

    // Listen for immediate logout broadcast from the web app and relay to extension
    // This enables zero-latency logout sync without waiting for periodic refresh
    let authChannel: BroadcastChannel | null = null;
    try {
      authChannel = new BroadcastChannel('promptok-auth');
      authChannel.onmessage = (bcEvent) => {
        const urlParams = new URLSearchParams(window.location.search);
        const parentOrigin = urlParams.get('parentOrigin');
        if (!parentOrigin) return;

        const payload = bcEvent?.data;
        if (payload && payload.type === 'PROMPTOK_LOGOUT') {
          console.log('[Extension Bridge] Received PROMPTOK_LOGOUT broadcast, notifying extension');
          sendTokenMessage(parentOrigin, { loggedIn: false });
        }
      };
    } catch (e) {
      console.warn('[Extension Bridge] BroadcastChannel not available:', e);
    }

    // Subscribe to Supabase auth state changes to catch logout events instantly
    const { data: authListener } = supabaseForEvents.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const parentOrigin = urlParams.get('parentOrigin');
          if (parentOrigin) {
            console.log('[Extension Bridge] Supabase SIGNED_OUT event detected, notifying extension');
            sendTokenMessage(parentOrigin, { loggedIn: false });
          }
        } catch {
          // ignore
        }
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      try {
        if (authChannel) {
          authChannel.close();
        }
      } catch {
        // ignore
      }
      try {
        authListener?.subscription?.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <div style={{ display: 'none' }}>
      {/* Hidden bridge page for extension authentication */}
    </div>
  );
}
