// PromptOK Extension Offscreen Document
// Handles secure JWT token retrieval via iframe bridge

class PromptOKOffscreenAuth {
  constructor() {
    this.iframe = null;
    this.currentJWT = null;
    this.refreshTimer = null;
    this.syncTimer = null;
    this.isRefreshing = false;
    this.extensionId = chrome.runtime.id;
    this.bridgeUrl = null;
    
    console.log('[PromptOK Offscreen] Initializing auth bridge');
    this.init();
  }

  async getBridgeUrl() {
    // Use environment-based configuration
    if (!window.promptokEnvConfig) {
      throw new Error('Environment configuration not loaded');
    }
    const baseUrl = await window.promptokEnvConfig.getApiBase();
    const parentOrigin = `chrome-extension://${this.extensionId}`;
    return `${baseUrl}/extension-auth/bridge?parentOrigin=${encodeURIComponent(parentOrigin)}`;
  }

  async init() {
    this.bridgeUrl = await this.getBridgeUrl();
    this.setupMessageListener();
    this.createIframe();
    this.setupBackgroundMessageHandler();
    this.startPeriodicSync();
  }

  setupMessageListener() {
    window.addEventListener('message', async (event) => {
      // Validate origin using environment config
      if (!window.promptokEnvConfig) {
        console.error('[PromptOK Offscreen] Environment configuration not loaded');
        return;
      }
      
      const apiBase = await window.promptokEnvConfig.getApiBase();
      const expectedOrigin = new URL(apiBase).origin;
      
      if (event.origin !== expectedOrigin) {
        console.warn('[PromptOK Offscreen] Ignored message from unauthorized origin:', event.origin);
        return;
      }

      // Validate message structure
      if (!event.data || event.data.type !== 'PROMPTOK_EXTENSION_TOKEN') {
        return;
      }

      console.log('[PromptOK Offscreen] Received token message from bridge');
      this.handleTokenMessage(event.data.payload);
    });
  }

  async createIframe() {
    // Remove existing iframe if present
    if (this.iframe) {
      this.iframe.remove();
    }

    // Ensure we have the bridge URL
    if (!this.bridgeUrl) {
      this.bridgeUrl = await this.getBridgeUrl();
    }

    console.log('[PromptOK Offscreen] Creating iframe:', this.bridgeUrl);
    
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.bridgeUrl;
    this.iframe.style.display = 'none';
    this.iframe.style.width = '0';
    this.iframe.style.height = '0';
    
    // Add error handling
    this.iframe.onerror = () => {
      console.error('[PromptOK Offscreen] Iframe failed to load');
      this.scheduleRetry();
    };

    this.iframe.onload = () => {
      console.log('[PromptOK Offscreen] Iframe loaded successfully');
    };

    document.getElementById('auth-container').appendChild(this.iframe);
  }

  handleTokenMessage(payload) {
    if (payload.error) {
      console.error('[PromptOK Offscreen] Token error:', payload.error);
      this.currentJWT = null;
      this.clearStoredJWT();
      this.notifyAuthStateChange(false);
      return;
    }

    if (payload.loggedIn === false) {
      console.log('[PromptOK Offscreen] User not logged in');
      this.currentJWT = null;
      this.clearStoredJWT();
      this.notifyAuthStateChange(false);
      return;
    }

    if (payload.jwt && payload.expiresAt) {
      console.log('[PromptOK Offscreen] Received valid JWT, expires:', new Date(payload.expiresAt));
      const wasAuthenticated = !!this.currentJWT;
      
      this.currentJWT = {
        jwt: payload.jwt,
        expiresAt: payload.expiresAt,
        scope: payload.scope,
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub,
        iat: payload.iat,
        exp: payload.exp,
        jti: payload.jti,
        token_version: payload.token_version
      };
      
      this.storeJWT();
      this.scheduleRefresh();
      
      // Notify if authentication state changed
      if (!wasAuthenticated) {
        this.notifyAuthStateChange(true);
      }
    }
  }

  async storeJWT() {
    try {
      // Store JWT in memory only - no persistent storage for security
      // The iframe bridge will provide fresh tokens as needed
      console.log('[PromptOK Offscreen] JWT stored in memory');
    } catch (error) {
      console.error('[PromptOK Offscreen] Failed to store JWT:', error);
    }
  }

  async clearStoredJWT() {
    try {
      // Clear JWT from memory
      this.currentJWT = null;
      console.log('[PromptOK Offscreen] JWT cleared from memory');
    } catch (error) {
      console.error('[PromptOK Offscreen] Failed to clear JWT:', error);
    }
  }

  // Notify background script of authentication state changes
  async notifyAuthStateChange(isAuthenticated) {
    try {
      await chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        isAuthenticated: isAuthenticated
      });
      console.log('[PromptOK Offscreen] Notified auth state change:', isAuthenticated);
    } catch (error) {
      console.warn('[PromptOK Offscreen] Failed to notify auth state change:', error);
    }
  }

  scheduleRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.currentJWT || !this.currentJWT.expiresAt) {
      return;
    }

    // Schedule refresh 60 seconds before expiry
    const refreshTime = this.currentJWT.expiresAt - Date.now() - (60 * 1000);
    
    if (refreshTime > 0) {
      console.log('[PromptOK Offscreen] Scheduling refresh in', Math.round(refreshTime / 1000), 'seconds');
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    } else {
      // Token expires soon, refresh immediately
      console.log('[PromptOK Offscreen] Token expires soon, refreshing immediately');
      this.refreshToken();
    }
  }

  refreshToken() {
    if (this.isRefreshing) {
      console.log('[PromptOK Offscreen] Refresh already in progress');
      return;
    }

    console.log('[PromptOK Offscreen] Refreshing JWT token');
    this.isRefreshing = true;
    
    // Recreate iframe to trigger new token fetch
    this.createIframe();
    
    // Reset refresh flag after a delay
    setTimeout(() => {
      this.isRefreshing = false;
    }, 5000);
  }

  scheduleRetry() {
    // Retry iframe creation after 30 seconds on error
    setTimeout(() => {
      console.log('[PromptOK Offscreen] Retrying iframe creation');
      this.createIframe();
    }, 30000);
  }

  // Start periodic sync to ensure extension stays in sync with webapp
  startPeriodicSync() {
    // Check authentication status every 30 seconds
    this.syncTimer = setInterval(() => {
      console.log('[PromptOK Offscreen] Performing periodic auth sync check');
      this.refreshToken();
    }, 30000);
  }

  // Stop periodic sync (cleanup)
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  setupBackgroundMessageHandler() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_EXTENSION_JWT' && message.target === 'offscreen') {
        this.handleJWTRequest((data) => {
          // Send response back to background script
          chrome.runtime.sendMessage({
            type: 'JWT_RESPONSE',
            data: data
          }).catch(console.warn);
        });
        sendResponse({ received: true });
        return false;
      }
      
      if (message.type === 'REFRESH_EXTENSION_JWT') {
        this.refreshToken();
        sendResponse({ ok: true });
        return false;
      }
    });
  }

  async handleJWTRequest(sendResponse) {
    try {
      // Check if current JWT is still valid
      if (this.currentJWT && this.currentJWT.expiresAt > Date.now() + (30 * 1000)) {
        // JWT is valid for at least 30 more seconds
        sendResponse({
          jwt: this.currentJWT.jwt,
          expiresAt: this.currentJWT.expiresAt
        });
        return;
      }

      // No stored JWT - rely on iframe bridge for fresh tokens
      const storedJWT = null;

      if (storedJWT && storedJWT.expiresAt > Date.now() + (30 * 1000)) {
        // Stored JWT is still valid
        this.currentJWT = storedJWT;
        sendResponse({
          jwt: storedJWT.jwt,
          expiresAt: storedJWT.expiresAt
        });
        return;
      }

      // No valid JWT available, trigger refresh
      console.log('[PromptOK Offscreen] No valid JWT available, triggering refresh');
      this.refreshToken();
      
      // Return null for now, caller should retry
      sendResponse({ jwt: null, expiresAt: null });
      
    } catch (error) {
      console.error('[PromptOK Offscreen] Error handling JWT request:', error);
      sendResponse({ jwt: null, expiresAt: null, error: error.message });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PromptOKOffscreenAuth();
  });
} else {
  new PromptOKOffscreenAuth();
}
