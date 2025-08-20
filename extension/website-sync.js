// Content script for website-extension communication
// This script runs on PromptOK website pages to handle extension detection and sync

// Push page token to extension storage
async function pushPageTokenToExtension() {
  try {
    const token = localStorage.getItem('sb-access-token');
    const updatedAtStr = localStorage.getItem('sb-access-token-updated-at');
    const updatedAt = updatedAtStr ? Number(updatedAtStr) : Date.now();
    if (token) {
      await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token, updatedAt });
      console.log('[PromptOK ext] Pushed page token to extension from website-sync');
    } else {
      console.log('[PromptOK ext] No page token found to push from website-sync');
    }
  } catch (error) {
    console.error('[PromptOK ext] Error pushing page token from website-sync:', error);
  }
}

// Listen for messages from the website
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;

  const { type, data } = event.data;

  switch (type) {
    case 'PROMPTOK_PING':
      // Respond with pong to indicate extension is present
      window.postMessage({
        type: 'PROMPTOK_PONG',
        source: 'extension',
        timestamp: Date.now()
      }, '*');
      break;

    case 'WEBSITE_AUTH_UPDATE':
      // Forward auth updates to background script
      if (data && data.accessToken) {
        chrome.runtime.sendMessage({
          type: 'SET_TOKEN',
          token: data.accessToken,
          updatedAt: data.timestamp || Date.now()
        }).catch(console.warn);
      }
      break;

    case 'SUPABASE_AUTH':
      // Handle legacy auth messages
      if (data && data.event === 'SIGNED_IN' && data.session) {
        const token = data.session.access_token;
        if (token) {
          chrome.runtime.sendMessage({
            type: 'SET_TOKEN',
            token: token,
            updatedAt: Date.now()
          }).then(() => {
            console.log('[PromptOK ext] Token synced from SUPABASE_AUTH message');
          }).catch(console.warn);
        }
      }
      break;

    case 'EXTENSION_AUTH_REQUEST':
      // Handle auth request from website
      chrome.runtime.sendMessage({
        type: 'GET_TOKEN'
      }).then(response => {
        if (response && response.token) {
          window.postMessage({
            type: 'WEBSITE_AUTH_UPDATE',
            source: 'extension',
            data: {
              accessToken: response.token,
              timestamp: Date.now()
            }
          }, '*');
        }
      }).catch(console.warn);
      break;

    case 'EXTENSION_LOGOUT':
      // Handle logout from extension
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-user-data');
      console.log('[PromptOK ext] Logout received from extension');
      
      // Redirect to signin if on protected page
      if (window.location.pathname.includes('/dashboard')) {
        window.location.href = '/auth/signin';
      }
      break;

    case 'WEBSITE_LOGOUT':
      // Handle logout from website - notify extension
      chrome.runtime.sendMessage({
        type: 'CLEAR_TOKEN'
      }).then(() => {
        console.log('[PromptOK ext] Website logout synced to extension');
      }).catch(console.warn);
      break;
  }
});

// Watch for localStorage changes and sync to extension
let lastPageToken = localStorage.getItem('sb-access-token');
setInterval(async () => {
  try {
    const current = localStorage.getItem('sb-access-token');
    if (current !== lastPageToken) {
      lastPageToken = current;
      // Update timestamp since page changed it
      const now = Date.now();
      localStorage.setItem('sb-access-token-updated-at', String(now));
      // Push to extension
      await pushPageTokenToExtension();
    }
  } catch (e) {
    // ignore
  }
}, 1000);

// Sync extension token to page localStorage
async function syncExtensionTokenToPage() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });
    if (response && response.token) {
      localStorage.setItem('sb-access-token', response.token);
      localStorage.setItem('sb-access-token-updated-at', String(Date.now()));
      console.log('[PromptOK ext] Synced extension token to page localStorage');
      
      // Trigger page refresh or auth state update
      if (window.location.pathname.includes('/auth/signin') || window.location.pathname.includes('/auth/signup')) {
        window.location.href = '/dashboard';
      }
    } else {
      // Extension has no token, clear page localStorage
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-user-data');
      console.log('[PromptOK ext] Cleared page tokens - extension not authenticated');
      
      // If on protected page, redirect to signin
      if (window.location.pathname.includes('/dashboard')) {
        window.location.href = '/auth/signin';
      }
    }
  } catch (error) {
    console.error('[PromptOK ext] Error syncing extension token to page:', error);
  }
}

// Listen for token updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOKEN_UPDATE') {
    if (message.token) {
      localStorage.setItem('sb-access-token', message.token);
      localStorage.setItem('sb-access-token-updated-at', String(message.updatedAt || Date.now()));
      console.log('[PromptOK ext] Token updated from extension');
      
      // If on signin page and now have token, redirect to dashboard
      if (window.location.pathname.includes('/auth/signin') || window.location.pathname.includes('/auth/signup')) {
        window.location.href = '/dashboard';
      }
    } else {
      // Token cleared
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-user-data');
      console.log('[PromptOK ext] Token cleared from extension');
      
      // If on protected page, redirect to signin
      if (window.location.pathname.includes('/dashboard')) {
        window.location.href = '/auth/signin';
      }
    }
    sendResponse({ success: true });
  }
  return true;
});

// Initial sync on page load
setTimeout(async () => {
  // Send initial ping to let website know extension is ready
  window.postMessage({
    type: 'PROMPTOK_PONG',
    source: 'extension',
    timestamp: Date.now()
  }, '*');
  
  // First sync extension token to page (in case extension is logged in)
  await syncExtensionTokenToPage();
  
  // Then push any page token to extension (in case page has newer token)
  await pushPageTokenToExtension();
}, 100);
