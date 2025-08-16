chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptOK installed');
});

// Notify all dashboard tabs about token updates
async function notifyDashboardTabs(token) {
  const tabs = await chrome.tabs.query({ url: '*://localhost/*/dashboard*' });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOKEN_UPDATE', token });
    } catch (e) {
      console.warn('Could not notify tab:', e);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TOKEN') {
    chrome.storage.local.set({ access_token: message.token })
      .then(() => {
        notifyDashboardTabs(message.token);
        sendResponse({ ok: true });
      });
    return true; // Keep the message channel open for async response
  }
});


