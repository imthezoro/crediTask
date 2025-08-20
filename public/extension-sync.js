// Extension sync functionality for PromptOK
// This script handles communication between the website and browser extension

class ExtensionSync {
  constructor() {
    this.isExtensionInstalled = false
    this.checkExtensionConnection()
    this.setupMessageListeners()
  }

  // Check if extension is installed and connected
  checkExtensionConnection() {
    // Send a ping to check if extension is available
    window.postMessage({ 
      type: 'PROMPTOK_PING', 
      source: 'website',
      timestamp: Date.now()
    }, '*')

    // Wait for response
    setTimeout(() => {
      if (!this.isExtensionInstalled) {
        console.log('PromptOK extension not detected')
      }
    }, 1000)
  }

  // Setup message listeners for extension communication
  setupMessageListeners() {
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return

      const { type, data } = event.data

      switch (type) {
        case 'PROMPTOK_PONG':
          this.isExtensionInstalled = true
          console.log('PromptOK extension detected and connected')
          break

        case 'EXTENSION_AUTH_REQUEST':
          this.handleAuthRequest()
          break

        case 'EXTENSION_LOGOUT':
          this.handleLogout()
          break
      }
    })
  }

  // Send authentication data to extension
  sendAuthToExtension(authData) {
    if (!this.isExtensionInstalled) {
      console.warn('Extension not available for auth sync')
      return
    }

    const message = {
      type: 'WEBSITE_AUTH_UPDATE',
      source: 'website',
      data: {
        accessToken: authData.accessToken,
        user: authData.user,
        timestamp: Date.now()
      }
    }

    // Send to extension via postMessage
    window.postMessage(message, '*')

    // Also try to send via extension API if available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage(process.env.NEXT_PUBLIC_EXTENSION_ID, message)
      } catch (error) {
        console.log('Direct extension communication not available:', error.message)
      }
    }
  }

  // Handle auth request from extension
  handleAuthRequest() {
    const accessToken = localStorage.getItem('sb-access-token')
    const userStr = localStorage.getItem('sb-user-data')
    
    if (accessToken && userStr) {
      try {
        const user = JSON.parse(userStr)
        this.sendAuthToExtension({ accessToken, user })
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    } else {
      // No auth data available, send empty response
      window.postMessage({
        type: 'WEBSITE_AUTH_UPDATE',
        source: 'website',
        data: null
      }, '*')
    }
  }

  // Handle logout request
  handleLogout() {
    // Clear local storage
    localStorage.removeItem('sb-access-token')
    localStorage.removeItem('sb-user-data')
    
    // Clear cookies
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    
    // Redirect to signin
    window.location.href = '/auth/signin'
  }

  // Store user data for extension access
  storeUserData(user) {
    try {
      localStorage.setItem('sb-user-data', JSON.stringify({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {}
      }))
    } catch (error) {
      console.error('Error storing user data:', error)
    }
  }

  // Get current auth status
  getAuthStatus() {
    const accessToken = localStorage.getItem('sb-access-token')
    const userStr = localStorage.getItem('sb-user-data')
    
    return {
      isAuthenticated: !!(accessToken && userStr),
      accessToken,
      user: userStr ? JSON.parse(userStr) : null
    }
  }
}

// Initialize extension sync
const extensionSync = new ExtensionSync()

// Export for use in other scripts
window.PromptOKExtensionSync = extensionSync
