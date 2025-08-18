chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptOK installed');
});

// Check if chrome.storage.local is available
const storage = {
  set: async (key, value) => {
    if (chrome.storage && chrome.storage.local) {
      return chrome.storage.local.set({ [key]: value });
    } else {
      // Fallback to localStorage if chrome.storage is not available
      console.warn('chrome.storage.local not available, falling back to localStorage');
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
  },
  get: async (key) => {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } else {
      // Fallback to localStorage
      return Promise.resolve(localStorage.getItem(key));
    }
  }
};

// Keeps track of the tab/window that initiated OAuth so we can return focus
let originContext = { tabId: null, windowId: null };

// Notify all dashboard tabs about token updates
async function notifyDashboardTabs(token, updatedAt) {
  try {
    const patterns = [
      '*://localhost/*/dashboard*',
      '*://localhost/dashboard*',
      '*://127.0.0.1/*/dashboard*',
      '*://127.0.0.1/dashboard*',
    ];
    const results = await Promise.allSettled(patterns.map(p => chrome.tabs.query({ url: p })));
    const allTabs = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value || []);
    const seen = new Set();
    for (const tab of allTabs) {
      if (seen.has(tab.id)) continue;
      seen.add(tab.id);
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOKEN_UPDATE', token, updatedAt });
      } catch (e) {
        console.warn('Could not notify tab:', e);
      }
    }
  } catch (e) {
    console.warn('Error querying tabs:', e);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_ORIGIN_TAB') {
    originContext = {
      tabId: typeof message.tabId === 'number' ? message.tabId : null,
      windowId: typeof message.windowId === 'number' ? message.windowId : null,
    };
    sendResponse({ ok: true });
    return; // no async work needed
  }
  if (message.type === 'SET_TOKEN') {
    const updatedAt = typeof message.updatedAt === 'number' ? message.updatedAt : Date.now();
    Promise.all([
      storage.set('access_token', message.token),
      storage.set('access_token_updated_at', updatedAt),
    ])
      .then(() => {
        notifyDashboardTabs(message.token, updatedAt);
        // If this message came from the OAuth callback tab, first refocus origin then close it
        try {
          const callbackTabId = sender?.tab?.id;
          const url = sender?.tab?.url || '';
          if (callbackTabId && typeof callbackTabId === 'number' && url.includes('/auth/callback')) {
            // Focus the original tab/window if we have them
            if (originContext.windowId != null) {
              chrome.windows.update(originContext.windowId, { focused: true }, () => void 0);
            }
            if (originContext.tabId != null) {
              chrome.tabs.update(originContext.tabId, { active: true }, () => void 0);
            }
            // Clear context so it doesn't affect future flows
            originContext = { tabId: null, windowId: null };
            // Now close the callback tab
            chrome.tabs.remove(callbackTabId, () => {
              if (chrome.runtime.lastError) {
                console.warn('Could not close OAuth tab:', chrome.runtime.lastError.message);
              }
            });
          }
        } catch (e) {
          console.warn('Error trying to close OAuth tab:', e);
        }
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('Error setting token:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  if (message.type === 'CLEAR_TOKEN') {
    // Remove token and notify all tabs to clear their page-local tokens
    const updatedAt = Date.now();
    Promise.all([
      storage.set('access_token', null),
      storage.set('access_token_updated_at', updatedAt),
    ])
      .then(() => {
        notifyDashboardTabs(null, updatedAt);
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('Error clearing token:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }
});


