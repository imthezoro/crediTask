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

// Notify all dashboard tabs about token updates
async function notifyDashboardTabs(token) {
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
        await chrome.tabs.sendMessage(tab.id, { type: 'TOKEN_UPDATE', token });
      } catch (e) {
        console.warn('Could not notify tab:', e);
      }
    }
  } catch (e) {
    console.warn('Error querying tabs:', e);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TOKEN') {
    storage.set('access_token', message.token)
      .then(() => {
        notifyDashboardTabs(message.token);
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('Error setting token:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});


