/**
 * PromptOK Authentication Sync
 * Handles bidirectional authentication synchronization between website and extension
 */

class AuthSync {
  constructor() {
    this.isInitialized = false;
    this.lastKnownToken = null;
    this.syncInProgress = false;
    
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    this.setupMessageHandlers();
    await this.performInitialSync();
    this.startTokenWatcher();
    
    this.isInitialized = true;
  }

  setupMessageHandlers() {
    // Handle messages from website
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      this.handleWebsiteMessage(event.data);
    });

    // Handle messages from extension background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOKEN_UPDATE') {
        this.handleExtensionTokenUpdate(message);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  handleWebsiteMessage(data) {
    const { type } = data;

    switch (type) {
      case 'PROMPTOK_PING':
        this.sendPong();
        break;
      
      case 'SUPABASE_AUTH':
        if (data.data?.event === 'SIGNED_IN' && data.data?.session?.access_token) {
          this.syncTokenToExtension(data.data.session.access_token);
        }
        break;
      
      case 'WEBSITE_LOGOUT':
        this.handleWebsiteLogout();
        break;
      
      case 'EXTENSION_AUTH_REQUEST':
        this.sendExtensionTokenToWebsite();
        break;
    }
  }

  sendPong() {
    window.postMessage({
      type: 'PROMPTOK_PONG',
      source: 'extension',
      timestamp: Date.now()
    }, '*');
  }

  async handleExtensionTokenUpdate(message) {
    const { token, updatedAt } = message;
    
    if (token) {
      localStorage.setItem('sb-access-token', token);
      localStorage.setItem('sb-access-token-updated-at', String(updatedAt || Date.now()));
      this.lastKnownToken = token;
      
      // Redirect to dashboard if on auth pages
      if (this.isOnAuthPage()) {
        window.location.href = '/dashboard';
      }
    } else {
      this.clearWebsiteAuth();
      
      // Redirect to signin if on protected pages
      if (this.isOnProtectedPage()) {
        window.location.href = '/auth/signin';
      }
    }
  }

  async syncTokenToExtension(token) {
    if (this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      const updatedAt = Date.now();
      
      localStorage.setItem('sb-access-token-updated-at', String(updatedAt));
      this.lastKnownToken = token;
      
      await chrome.runtime.sendMessage({
        type: 'SET_TOKEN',
        token,
        updatedAt
      });
    } catch (error) {
      console.warn('[AuthSync] Failed to sync token to extension:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async sendExtensionTokenToWebsite() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });
      if (response?.token) {
        window.postMessage({
          type: 'WEBSITE_AUTH_UPDATE',
          source: 'extension',
          data: {
            accessToken: response.token,
            timestamp: Date.now()
          }
        }, '*');
      }
    } catch (error) {
      console.warn('[AuthSync] Failed to get extension token:', error);
    }
  }

  async handleWebsiteLogout() {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' });
    } catch (error) {
      console.warn('[AuthSync] Failed to clear extension token:', error);
    }
  }

  clearWebsiteAuth() {
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-user-data');
    this.lastKnownToken = null;
  }

  async performInitialSync() {
    // Send initial pong
    this.sendPong();
    
    try {
      // Get extension token
      const response = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });
      const extensionToken = response?.token;
      const websiteToken = localStorage.getItem('sb-access-token');
      
      if (extensionToken && !websiteToken) {
        // Extension has token, website doesn't - sync to website
        localStorage.setItem('sb-access-token', extensionToken);
        localStorage.setItem('sb-access-token-updated-at', String(Date.now()));
        this.lastKnownToken = extensionToken;
        
        if (this.isOnAuthPage()) {
          window.location.href = '/dashboard';
        }
      } else if (websiteToken && !extensionToken) {
        // Website has token, extension doesn't - sync to extension
        await this.syncTokenToExtension(websiteToken);
      } else if (!extensionToken && !websiteToken) {
        // Neither has token - redirect to auth if on protected page
        if (this.isOnProtectedPage()) {
          window.location.href = '/auth/signin';
        }
      }
      
      this.lastKnownToken = websiteToken;
    } catch (error) {
      console.warn('[AuthSync] Initial sync failed:', error);
    }
  }

  startTokenWatcher() {
    // Watch for localStorage changes
    setInterval(() => {
      const currentToken = localStorage.getItem('sb-access-token');
      
      if (currentToken !== this.lastKnownToken && !this.syncInProgress) {
        this.lastKnownToken = currentToken;
        
        if (currentToken) {
          // Token added/changed - sync to extension
          this.syncTokenToExtension(currentToken);
        } else {
          // Token removed - clear extension
          this.handleWebsiteLogout();
        }
      }
    }, 1000);
  }

  isOnAuthPage() {
    const path = window.location.pathname;
    return path.includes('/auth/signin') || path.includes('/auth/signup');
  }

  isOnProtectedPage() {
    const path = window.location.pathname;
    return path.includes('/dashboard') || path.includes('/billing');
  }
}

// Initialize auth sync
new AuthSync();
