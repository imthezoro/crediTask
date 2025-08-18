// This script runs on PromptOK pages to keep the web app and extension auth states in sync

// 1) Receive updates FROM extension background and reflect to page localStorage
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TOKEN_UPDATE') {
    try {
      const updatedAt = typeof message.updatedAt === 'number' ? message.updatedAt : Date.now();
      localStorage.setItem('sb-access-token-updated-at', String(updatedAt));
      if (message.token) {
        localStorage.setItem('sb-access-token', message.token);
        console.log('[PromptOK ext] Token updated in page localStorage');
      } else {
        localStorage.removeItem('sb-access-token');
        console.log('[PromptOK ext] Token cleared from page localStorage');
      }
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
    const updatedAtStr = localStorage.getItem('sb-access-token-updated-at');
    const updatedAt = updatedAtStr ? Number(updatedAtStr) : Date.now();
    if (token) {
      await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token, updatedAt });
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
    const result = await chrome.storage.local.get(['access_token', 'access_token_updated_at']);
    const extToken = result.access_token || null;
    const extUpdatedAt = typeof result.access_token_updated_at === 'number' ? result.access_token_updated_at : 0;
    const pageUpdatedAt = Number(localStorage.getItem('sb-access-token-updated-at') || '0');
    if (extToken) {
      localStorage.setItem('sb-access-token', extToken);
      localStorage.setItem('sb-access-token-updated-at', String(extUpdatedAt || Date.now()));
      console.log('[PromptOK ext] Mirrored extension token to page localStorage');
    } else {
      // If extension has no token, ensure page localStorage is cleared to avoid stale tokens
      localStorage.removeItem('sb-access-token');
      console.log('[PromptOK ext] Cleared page token because extension has none');
    }
  } catch (e) {
    console.warn('[PromptOK ext] Could not mirror token to page', e);
  }
  // Then, push any freshly created page token (e.g., after OAuth) back to extension
  try {
    const result = await chrome.storage.local.get(['access_token', 'access_token_updated_at']);
    const extToken = result.access_token || null;
    const extUpdatedAt = typeof result.access_token_updated_at === 'number' ? result.access_token_updated_at : 0;
    const pageUpdatedAt = Number(localStorage.getItem('sb-access-token-updated-at') || '0');
    if (!extToken) {
      await pushPageTokenToExtension();
    } else if (pageUpdatedAt > extUpdatedAt) {
      await pushPageTokenToExtension();
    } else {
      console.log('[PromptOK ext] Skipped pushing page token; extension token is newer or equal');
    }
  } catch (e) {
    console.warn('[PromptOK ext] Could not evaluate whether to push page token', e);
  }
}

bidirectionalSyncOnLoad();

// 4.5) Watch for in-page token changes (e.g., user signs in/out on web)
let __promptok_last_page_token = localStorage.getItem('sb-access-token');
setInterval(async () => {
  try {
    const current = localStorage.getItem('sb-access-token');
    if (current !== __promptok_last_page_token) {
      __promptok_last_page_token = current;
      // Stamp updatedAt since page changed it without timestamp
      const now = Date.now();
      localStorage.setItem('sb-access-token-updated-at', String(now));
      // Push to extension (it will arbitrate with last-writer-wins)
      await pushPageTokenToExtension();
    }
  } catch (_e) {
    // ignore
  }
}, 1200);

// Periodic reconcile to keep long-lived tabs synced (runs light logic)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['access_token', 'access_token_updated_at']);
    const extToken = result.access_token || null;
    const extUpdatedAt = typeof result.access_token_updated_at === 'number' ? result.access_token_updated_at : 0;
    const pageToken = localStorage.getItem('sb-access-token');
    const pageUpdatedAt = Number(localStorage.getItem('sb-access-token-updated-at') || '0');
    if (pageUpdatedAt > extUpdatedAt) {
      // Page is fresher
      await pushPageTokenToExtension();
    } else if (extUpdatedAt > pageUpdatedAt) {
      // Extension is fresher
      if (extToken) {
        localStorage.setItem('sb-access-token', extToken);
        localStorage.setItem('sb-access-token-updated-at', String(extUpdatedAt));
      } else {
        localStorage.removeItem('sb-access-token');
        localStorage.setItem('sb-access-token-updated-at', String(extUpdatedAt));
      }
    }
  } catch (_e) {
    // ignore
  }
}, 5000);
