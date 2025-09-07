// Removed unused handleLogin function - authentication now handled via redirect

function showError(element, message) {
  element.textContent = message;
  element.className = 'status error';
}

function showSuccess(element, message) {
  element.textContent = message;
  element.className = 'status success';
}

// DOM Elements
const loggedInView = document.getElementById('loggedInView');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');

// Check authentication status when popup loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded, checking auth status...');
  
  // Start with loading view to prevent flash
  showView('loading');
  
  try {
    // Use the proper iframe bridge system to check authentication
    const isAuthenticated = await checkAuthenticationViaJWT();
    
    // Parameterize portal links immediately
    setPortalLinksBase().catch(console.warn);

    if (isAuthenticated) {
      console.log('User is authenticated, loading profile and showing logged in view');
      await loadUserCredits();
      showView('loggedIn');
    } else {
      console.log('User is not authenticated, showing unauthenticated view');
      showView('unauthenticated');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    showView('unauthenticated');
  }
  
  // Initialize other event listeners
  initEventListeners();
});

// Check authentication status via direct server call (simplified approach)
async function checkAuthenticationViaJWT() {
  try {
    console.log('[PromptOK Popup] Checking authentication status...');
    
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';

    // Check authentication directly with server using cookies
    const response = await fetch(`${base}/api/extension-token`, {
      method: 'GET',
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.jwt && data.expiresAt > Date.now()) {
        console.log('[PromptOK Popup] Valid JWT received, user is authenticated');
        
        // Store JWT for future use
        await chrome.storage.local.set({
          'extension_jwt': data,
          'extension_jwt_updated_at': Date.now()
        });
        
        return true;
      } else if (data.loggedIn === false) {
        console.log('[PromptOK Popup] Server reports user not logged in');
        await chrome.storage.local.remove(['extension_jwt', 'extension_jwt_updated_at']);
        return false;
      }
    }
    
    console.log('[PromptOK Popup] Authentication check failed');
    await chrome.storage.local.remove(['extension_jwt', 'extension_jwt_updated_at']);
    return false;
  } catch (error) {
    console.error('[PromptOK Popup] Error checking authentication:', error);
    return false;
  }
}

// Load user credits and profile information
async function loadUserCredits() {
  try {
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';

    // Get stored JWT token
    const result = await chrome.storage.local.get(['extension_jwt']);
    const jwtData = result.extension_jwt;
    
    if (!jwtData || !jwtData.jwt) {
      console.log('No JWT available for loading credits');
      return;
    }

    // Fetch user profile and credits from the API using JWT
    const response = await fetch(`${base}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtData.jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      
      // Update the UI with actual user data
      updateUserProfile({
        name: userData.name || userData.full_name || 'User',
        email: userData.email || 'user@promptok.com',
        plan: userData.plan || 'free',
        credits: userData.credits || userData.usage_remaining || 0
      });
      
      setAvatarInitials(userData.name || userData.full_name || 'User', userData.email || '');
    } else {
      console.warn('Failed to load user profile, using defaults');
      // Fallback to basic authenticated state
      updateUserProfile({
        name: 'Authenticated User',
        email: 'user@promptok.com',
        plan: 'free',
        credits: 0
      });
      setAvatarInitials('Authenticated User', 'user@promptok.com');
    }
  } catch (error) {
    console.error('Error loading user credits:', error);
    // Fallback to basic authenticated state
    updateUserProfile({
      name: 'Authenticated User', 
      email: 'user@promptok.com',
      plan: 'free',
      credits: 0
    });
    setAvatarInitials('Authenticated User', 'user@promptok.com');
  }
}

// Handle sign-in redirect
async function handleSignInRedirect() {
  try {
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    
    // Open the sign-in page in a new tab
    chrome.tabs.create({ url: `${base}/auth/signin` });
    
    // Close the popup
    window.close();
  } catch (error) {
    console.error('Sign-in redirect error:', error);
    // Fallback to localhost
    chrome.tabs.create({ url: 'http://localhost:3000/auth/signin' });
    window.close();
  }
}

// Update the UI with user profile data
function updateUserProfile(userData) {
  // Check if this is a guest user by email
  const isGuestUser = userData.email && userData.email.includes('@promptok.guest');
  
  if (isGuestUser) {
    // For guest users, always display 'Guest' as the name
    userNameEl.textContent = 'Guest';
  } else if (userData.name) {
    userNameEl.textContent = userData.name;
  } else if (userData.firstName || userData.lastName) {
    userNameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  } else {
    userNameEl.textContent = '';
  }
  
  if (userData.email !== undefined) {
    // If it's a guest email (contains @promptok.guest), display just 'Guest'
    if (userData.email.includes('@promptok.guest')) {
      userEmailEl.textContent = 'Guest';
    } else {
      userEmailEl.textContent = userData.email;
    }
  }
  
  // Update plan and credits if available
  if (userData.plan) {
    const planBadge = document.querySelector('.plan-badge span');
    if (planBadge) {
      planBadge.textContent = userData.plan.toUpperCase();
    }
  }
  
  if (userData.credits !== undefined) {
    const creditCount = document.querySelector('.credit-count');
    if (creditCount) {
      creditCount.textContent = userData.credits;
    }
  }
  // Also refresh initials if possible
  setAvatarInitials(userData.name || userData.firstName || userData.lastName || '', userData.email || '');
}

// Compute and set avatar initials
function computeInitials(name, email) {
  // If it's a guest email, use 'Guest' for initials
  if (email && email.includes('@promptok.guest')) {
    return 'GU';
  }
  
  const src = (name || '').trim() || (email || '').trim();
  if (!src) return '';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  // For single word or email
  const word = src.includes('@') ? src.split('@')[0] : src;
  const letters = word.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
  if (letters.length === 1) return letters[0].toUpperCase();
  return '';
}

function setAvatarInitials(name, email) {
  const el = document.querySelector('.user-avatar .initials');
  if (!el) return;
  el.textContent = computeInitials(name, email);
}

// Skeleton toggles for profile and nav
function startProfileSkeleton() {
  const avatar = document.querySelector('.user-avatar');
  const name = document.getElementById('userName');
  const email = document.getElementById('userEmail');
  const navItems = document.querySelectorAll('.nav-item');
  avatar && avatar.classList.add('skeleton', 'skeleton-avatar');
  name && name.classList.add('skeleton', 'skeleton-line', 'lg');
  email && email.classList.add('skeleton', 'skeleton-line');
  navItems.forEach(a => a.classList.add('skeleton', 'skeleton-nav'));
}

function stopProfileSkeleton() {
  const avatar = document.querySelector('.user-avatar');
  const name = document.getElementById('userName');
  const email = document.getElementById('userEmail');
  const navItems = document.querySelectorAll('.nav-item');
  avatar && avatar.classList.remove('skeleton', 'skeleton-avatar');
  name && name.classList.remove('skeleton', 'skeleton-line', 'lg');
  email && email.classList.remove('skeleton', 'skeleton-line');
  navItems.forEach(a => a.classList.remove('skeleton', 'skeleton-nav'));
}

// Parameterize portal links (dashboard/billing/profile)
async function setPortalLinksBase() {
  try {
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    const dash = document.getElementById('linkDashboard');
    const bill = document.getElementById('linkBilling');
    const prof = document.getElementById('linkProfile');
    if (dash) dash.href = `${base}/dashboard`;
    if (bill) bill.href = `${base}/billing`;
    if (prof) prof.href = `${base}/profile`;
  } catch (e) {
    console.warn('Failed to set portal links base', e);
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Show loading state
    showView('loading');
    
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    
    // First, call the server logout endpoint to clear the session
    try {
      await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies to clear session
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('[PromptOK] Server logout successful');
    } catch (logoutError) {
      console.warn('Server logout failed, continuing with local cleanup:', logoutError);
    }
    
    // Clear JWT tokens from extension storage
    await chrome.storage.local.remove(['extension_jwt', 'extension_jwt_updated_at']);
    
    // Trigger JWT refresh to sync with server state (user is now logged out)
    try {
      await chrome.runtime.sendMessage({ 
        type: 'REFRESH_EXTENSION_JWT'
      });
      console.log('[PromptOK] JWT refresh triggered after logout');
    } catch (e) {
      console.warn('Failed to trigger JWT refresh:', e);
    }
    
    // Show unauthenticated view
    showView('unauthenticated');
    
    console.log('[PromptOK] Logout completed successfully');
  } catch (error) {
    console.error('[PromptOK] Logout error:', error);
    // Even if logout fails, clear local state and show unauthenticated view
    await chrome.storage.local.remove(['extension_jwt', 'extension_jwt_updated_at']);
    showView('unauthenticated');
  }
}

// Removed unused startGoogleOAuth function - OAuth now handled via website redirect

// Initialize event listeners
function initEventListeners() {
  // Add ripple effect to all buttons
  const buttons = document.querySelectorAll('.btn:not(.btn-text)');
  buttons.forEach(button => {
    button.addEventListener('click', createRipple);
  });
  
  // Sign-in redirect button
  const signInRedirectBtn = document.getElementById('signInRedirect');
  if (signInRedirectBtn) {
    signInRedirectBtn.addEventListener('click', handleSignInRedirect);
  }
  
  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// Toggle between views
function showView(view) {
  // Hide all views first
  const loadingView = document.getElementById('loadingView');
  const unauthenticatedView = document.getElementById('unauthenticatedView');
  const loggedInView = document.getElementById('loggedInView');
  
  if (loadingView) loadingView.style.display = 'none';
  if (unauthenticatedView) unauthenticatedView.style.display = 'none';
  if (loggedInView) loggedInView.style.display = 'none';
  
  // Clear status messages
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }
  
  // Show the requested view
  switch(view) {
    case 'loading':
      if (loadingView) loadingView.style.display = 'block';
      break;
    case 'unauthenticated':
      if (unauthenticatedView) unauthenticatedView.style.display = 'block';
      break;
    case 'loggedIn':
      if (loggedInView) loggedInView.style.display = 'block';
      break;
    default:
      if (unauthenticatedView) unauthenticatedView.style.display = 'block';
  }
}

// Create ripple effect
function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  
  circle.classList.add('ripple');
  circle.style.width = circle.style.height = `${size}px`;
  circle.style.left = `${event.clientX - rect.left - size / 2}px`;
  circle.style.top = `${event.clientY - rect.top - size / 2}px`;
  
  const ripple = button.getElementsByClassName('ripple')[0];
  if (ripple) {
    ripple.remove();
  }
  
  button.appendChild(circle);
  
  setTimeout(() => {
    circle.remove();
  }, 600);
}

// Show loading state on a button
function setLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
  } else {
    button.classList.remove('loading');
    button.disabled = false;
  }
}

// All unused authentication functions removed - authentication now handled via website redirect

