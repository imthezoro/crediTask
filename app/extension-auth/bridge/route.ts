import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentOrigin = searchParams.get('parentOrigin');

  // Validate parentOrigin parameter
  if (!parentOrigin) {
    return new NextResponse(
      `<html><head><title>Extension Auth Bridge - Error</title></head><body><script>console.error('[PromptOK Bridge] Missing parentOrigin parameter');</script></body></html>`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }

  // Validate that parentOrigin is a chrome-extension:// URL
  if (!parentOrigin.startsWith('chrome-extension://')) {
    return new NextResponse(
      `<html><head><title>Extension Auth Bridge - Error</title></head><body><script>console.error('[PromptOK Bridge] Invalid parentOrigin:', '${parentOrigin}');</script></body></html>`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }

  // Extract extension ID from parentOrigin for validation
  const extensionId = parentOrigin.replace('chrome-extension://', '');
  const allowedExtensionIds = [
    'agoffikldhbnplphjknagiacideikboj', // Dev extension ID from docs
    // TODO: Add production extension ID when available
    // 'prod-extension-id-here',
  ];

  if (!allowedExtensionIds.includes(extensionId)) {
    return new NextResponse(
      `<html><head><title>Extension Auth Bridge - Error</title></head><body><script>console.error('[PromptOK Bridge] Unauthorized extension ID:', '${extensionId}');</script></body></html>`,
      {
        status: 403,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PromptOK Extension Auth Bridge</title>
  <meta name="robots" content="noindex, nofollow" />
</head>
<body style="margin: 0; padding: 0; display: none;">
  <script>
    (function() {
      const parentOrigin = '${parentOrigin}';
      
      console.log('[PromptOK Bridge] Initializing for origin:', parentOrigin);
      
      // Function to fetch extension token
      async function fetchExtensionToken() {
        try {
          const response = await fetch('/api/extension-token', {
            method: 'GET',
            credentials: 'include', // Include cookies for session
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': Failed to fetch token');
          }
          
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('[PromptOK Bridge] Token fetch error:', error);
          return { error: error.message };
        }
      }
      
      // Function to send message to parent
      function sendToParent(payload) {
        try {
          window.parent.postMessage({
            type: 'PROMPTOK_EXTENSION_TOKEN',
            payload: payload,
            timestamp: Date.now()
          }, parentOrigin);
          console.log('[PromptOK Bridge] Message sent to parent:', payload);
        } catch (error) {
          console.error('[PromptOK Bridge] Failed to send message to parent:', error);
        }
      }
      
      // Main execution
      async function main() {
        console.log('[PromptOK Bridge] Fetching extension token...');
        
        const tokenData = await fetchExtensionToken();
        
        if (tokenData.error) {
          sendToParent({ 
            error: tokenData.error,
            loggedIn: false 
          });
        } else if (tokenData.loggedIn === false) {
          sendToParent({ loggedIn: false });
        } else {
          // Send successful token data
          sendToParent({
            jwt: tokenData.jwt,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
            iss: tokenData.iss,
            aud: tokenData.aud,
            sub: tokenData.sub,
            iat: tokenData.iat,
            exp: tokenData.exp,
            jti: tokenData.jti,
            token_version: tokenData.token_version,
            loggedIn: true
          });
        }
      }
      
      // Execute immediately when page loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
      } else {
        main();
      }
    })();
  </script>
</body>
</html>`;

  // Set custom headers that allow framing by extension and override global security headers
  const headers = new Headers({
    'Content-Type': 'text/html',
    'Content-Security-Policy': 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'self' chrome-extension://agoffikldhbnplphjknagiacideikboj chrome-extension://prod-extension-id-placeholder;",
    // Explicitly do not set X-Frame-Options to allow CSP to handle framing
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  return new NextResponse(html, { headers });
}
