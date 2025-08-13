chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptOK installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_TOKEN') {
    chrome.storage.local.set({ access_token: message.token }).then(() => sendResponse({ ok: true }));
    return true;
  }
});


