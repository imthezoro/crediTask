chrome.runtime.onInstalled.addListener(() => {
  console.log('[PromptOK Background] Extension installed');
  // Initialize offscreen document for JWT authentication
  setupOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[PromptOK Background] Extension startup');
  // Ensure offscreen document is available on startup
  setupOffscreenDocument();
});

// Offscreen document management
let offscreenDocumentReady = false;

async function setupOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });

    if (existingContexts.length > 0) {
      console.log('[PromptOK Background] Offscreen document already exists');
      offscreenDocumentReady = true;
      return;
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'], // Required reason for MV3
      justification: 'Secure JWT token management via iframe bridge'
    });

    offscreenDocumentReady = true;
    console.log('[PromptOK Background] Offscreen document created successfully');
  } catch (error) {
    console.error('[PromptOK Background] Failed to setup offscreen document:', error);
    offscreenDocumentReady = false;
  }
}

// Keeps track of the tab/window that initiated OAuth so we can return focus
let originContext = { tabId: null, windowId: null };

// JWT token management functions
async function getExtensionJWT() {
  try {
    if (!offscreenDocumentReady) {
      console.log('[PromptOK Background] Offscreen document not ready, setting up...');
      await setupOffscreenDocument();
      
      if (!offscreenDocumentReady) {
        throw new Error('Offscreen document not available');
      }
      
      // Wait a moment for offscreen document to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Send message directly to offscreen document
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (contexts.length === 0) {
      throw new Error('No offscreen document found');
    }

    // Request JWT from offscreen document using tabs messaging
    return new Promise((resolve) => {
      const messageHandler = (message, sender, sendResponse) => {
        if (message.type === 'JWT_RESPONSE') {
          chrome.runtime.onMessage.removeListener(messageHandler);
          resolve(message.data);
        }
      };
      
      chrome.runtime.onMessage.addListener(messageHandler);
      
      // Send message to offscreen document
      chrome.runtime.sendMessage({
        type: 'GET_EXTENSION_JWT',
        target: 'offscreen'
      }).catch(() => {
        // If direct messaging fails, try alternative approach
        setTimeout(() => {
          resolve({ jwt: null, expiresAt: null, error: 'Offscreen communication failed' });
        }, 5000);
      });
    });
  } catch (error) {
    console.error('[PromptOK Background] Error getting JWT:', error);
    return { jwt: null, expiresAt: null, error: error.message };
  }
}

async function refreshExtensionJWT() {
  try {
    if (!offscreenDocumentReady) {
      await setupOffscreenDocument();
    }

    await chrome.runtime.sendMessage({
      type: 'REFRESH_EXTENSION_JWT'
    });

    console.log('[PromptOK Background] JWT refresh triggered');
  } catch (error) {
    console.error('[PromptOK Background] Error refreshing JWT:', error);
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

  // Handle authentication state changes from offscreen document
  if (message.type === 'AUTH_STATE_CHANGED') {
    console.log('[PromptOK Background] Auth state changed:', message.isAuthenticated);
    // Could notify other parts of extension if needed
    sendResponse({ ok: true });
    return;
  }

  // New JWT-based token requests
  if (message.type === 'GET_EXTENSION_JWT') {
    getExtensionJWT()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('[PromptOK Background] JWT request failed:', error);
        sendResponse({ jwt: null, expiresAt: null, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'REFRESH_EXTENSION_JWT') {
    refreshExtensionJWT()
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('[PromptOK Background] JWT refresh failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  // Handle API requests from content scripts (avoids CORS issues)
  if (message.type === 'MAKE_API_REQUEST') {
    const { url, method, headers, body } = message;
    
    fetch(url, {
      method: method || 'POST',
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({ error: 'Failed to parse response' }));
        sendResponse({
          ok: response.ok,
          status: response.status,
          data: data
        });
      })
      .catch(error => {
        console.error('[PromptOK Background] API request failed:', error);
        sendResponse({
          ok: false,
          status: 0,
          data: { error: error.message || 'Network error' }
        });
      });
    return true; // Keep channel open for async response
  }
  
  // Legacy handlers removed - now using JWT-based authentication only
});


