// This script runs on the dashboard page to sync the auth token from extension storage to localStorage

// Listen for token updates from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TOKEN_UPDATE') {
    localStorage.setItem('sb-access-token', message.token);
    console.log('Token updated in localStorage');
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

// Initial token sync
async function syncToken() {
  try {
    const { access_token } = await chrome.storage.local.get('access_token');
    if (access_token) {
      localStorage.setItem('sb-access-token', access_token);
      console.log('Initial token synced to localStorage');
    }
  } catch (error) {
    console.error('Error syncing token:', error);
  }
}

// Run initial sync
syncToken();
