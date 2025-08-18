// This script runs on PromptOK pages to keep the web app and extension auth states in sync

// 1) Receive updates FROM extension background and reflect to page localStorage
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TOKEN_UPDATE') {
    try {
      localStorage.setItem('sb-access-token', message.token);
      console.log('[PromptOK ext] Token updated in page localStorage');
      sendResponse({ success: true });
    } catch (e) {
      console.error('[PromptOK ext] Failed to set localStorage token', e);
      sendResponse({ success: false, error: String(e?.message || e) });
    }
  }
  return true; // Keep the message channel open for async response
});

// 2) Push existing page token TO extension storage on load (helps after OAuth)
async function pushPageTokenToExtension() {
  try {
    const token = localStorage.getItem('sb-access-token');
    if (token) {
      await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token });
      console.log('[PromptOK ext] Pushed page token to extension');
    } else {
      console.log('[PromptOK ext] No page token found to push');
    }
  } catch (error) {
    console.error('[PromptOK ext] Error pushing page token:', error);
  }
}

// 3) Listen for page->content messages (sent by /auth/callback) and forward to background
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin for safety
  if (event.origin !== window.location.origin) return;
  const msg = event.data || {};
  if (msg && msg.type === 'SUPABASE_AUTH' && msg.event === 'SIGNED_IN' && msg.session) {
    const token = msg.session?.access_token || msg.session?.accessToken || msg.session?.access_token;
    if (token) {
      chrome.runtime.sendMessage({ type: 'SET_TOKEN', token })
        .then(() => console.log('[PromptOK ext] Received SUPABASE_AUTH and stored token'))
        .catch((e) => console.error('[PromptOK ext] Failed to forward token', e));
    }
  }
});

// 4) On load, sync in both directions: background->page, then page->extension
async function bidirectionalSyncOnLoad() {
  // First, try to mirror any existing extension token into the page (keeps app logged in)
  try {
    const { access_token } = await chrome.storage.local.get('access_token');
    if (access_token) {
      localStorage.setItem('sb-access-token', access_token);
      console.log('[PromptOK ext] Mirrored extension token to page localStorage');
    }
  } catch (e) {
    console.warn('[PromptOK ext] Could not mirror token to page', e);
  }
  // Then, push any freshly created page token (e.g., after OAuth) back to extension
  await pushPageTokenToExtension();
}

bidirectionalSyncOnLoad();
