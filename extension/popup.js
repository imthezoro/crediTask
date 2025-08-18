async function handleLogin(e) {
  e.preventDefault();
  
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const email = emailEl?.value.trim() || '';
  const password = passEl?.value || '';
  
  // Basic validation
  if (!email) {
    showError(statusEl, 'Please enter your email');
    return;
  }

  if (!password) {
    showError(statusEl, 'Please enter your password');
    return;
  }
  
  try {
    setLoading(loginForm, true);
    
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json().catch(() => ({}));
    
    if (res.ok && data.access_token) {
      // Store the token in local storage with consistent key
      await chrome.storage.local.set({ access_token: data.access_token });
      
      // Show success message
      showSuccess(statusEl, 'Login successful!');
      
      // Load user profile; loadUserProfile will decide which view to show
      await loadUserProfile();
      
      // Notify the background script about the login
      chrome.runtime.sendMessage({ 
        type: 'USER_LOGGED_IN',
        token: data.access_token
      });
      
    } else {
      const errorMsg = data.error || data.message || `Status: ${res.status}`;
      showError(statusEl, `Login failed: ${errorMsg}`);
    }
    
  } catch (error) {
    console.error('Login error:', error);
    const errorMsg = error.message.includes('Failed to fetch') 
      ? 'Unable to connect to server. Please try again later.' 
      : error.message;
    showError(statusEl, `Error: ${errorMsg}`);
  } finally {
    setLoading(loginForm, false);
  }
}

function showError(element, message) {
  element.textContent = message;
  element.className = 'status error';
}

function showSuccess(element, message) {
  element.textContent = message;
  element.className = 'status success';
}

// DOM Elements
const loginView = document.getElementById('loginView');
const signupView = document.getElementById('signupView');
const loggedInView = document.getElementById('loggedInView');
const loginForm = document.getElementById('login');
const signupForm = document.getElementById('signup');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const statusEl = document.getElementById('status');
const signupStatusEl = document.getElementById('signupStatus');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const googleLoginBtn = document.getElementById('googleLogin');
const googleLoginSignupBtn = document.getElementById('googleLoginSignup');

// Check authentication status when popup loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded, checking auth status...');
  try {
    // Check if user is already authenticated
    const result = await chrome.storage.local.get('access_token');
    console.log('Storage result:', result);
    const access_token = result.access_token;
    
    // Parameterize portal links immediately
    setPortalLinksBase().catch(console.warn);

    if (access_token) {
      console.log('Found access token, attempting profile load');
      // Attempt to load profile; loadUserProfile will decide which view to show
      startProfileSkeleton();
      await loadUserProfile();
      stopProfileSkeleton();
    } else {
      console.log('No access token found, showing login view');
      showView('login');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    showView('login');
  }
  
  // Initialize other event listeners
  initEventListeners();
  
  // Listen for token changes to auto-switch UI without reopening the popup
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'local' && changes.access_token) {
          const newToken = changes.access_token.newValue;
          if (newToken) {
            console.log('[PromptOK popup] access_token added/updated, loading profile');
            startProfileSkeleton();
            await loadUserProfile();
            stopProfileSkeleton();
          } else {
            console.log('[PromptOK popup] access_token removed, switching to login');
            showView('login');
          }
        }
      });
    }
  } catch (e) {
    console.warn('Could not attach storage change listener', e);
  }
});

// Load user profile data
async function loadUserProfile() {
  try {
    const { access_token } = await chrome.storage.local.get('access_token');
    if (!access_token) {
      showView('login');
      return;
    }
    
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    console.debug('[PromptOK] Backend user endpoint:', `${base}/api/auth/user`);
    const res = await fetch(`${base}/api/auth/user`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      }
    });
    
    if (res.ok) {
      const payload = await res.json().catch(() => null);
      const user = payload?.user ?? payload; // Support both { user } and raw user
      if (!user || (!user.email && !user?.user_metadata?.name && !user?.user_metadata?.full_name)) {
        console.error('[PromptOK] /api/auth/user missing essential fields', payload);
        await chrome.storage.local.remove('access_token');
        showView('login');
        return;
      }
      // Guard: ensure this is an authenticated user (Supabase typically sets aud="authenticated")
      if (user?.aud && user.aud !== 'authenticated') {
        console.warn('[PromptOK] Non-authenticated audience in user payload', { aud: user.aud });
        await chrome.storage.local.remove('access_token');
        showView('login');
        return;
      }
      const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        '';
      updateUserProfile({
        name: displayName,
        email: user?.email || '',
      });
      setAvatarInitials(displayName, user?.email || '');
      // Only after successful user population, show the logged-in view
      showView('loggedIn');
    } else {
      const bodyText = await res.text().catch(() => '');
      console.error('[PromptOK] Supabase /auth/v1/user failed', {
        status: res.status,
        statusText: res.statusText,
        body: bodyText?.slice(0, 500),
      });
      // If token is invalid, clear it and show login
      if (res.status === 401 || res.status === 403) {
        await chrome.storage.local.remove('access_token');
        showView('login');
      } else {
        showError(statusEl, `Could not load profile (HTTP ${res.status})`);
      }
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    // On any error, ensure we show login view and do not display placeholders
    try { await chrome.storage.local.remove('access_token'); } catch (_) {}
    showView('login');
  }
}

// Update the UI with user profile data
function updateUserProfile(userData) {
  if (userData.name) {
    userNameEl.textContent = userData.name;
  } else if (userData.firstName || userData.lastName) {
    userNameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  } else {
    userNameEl.textContent = '';
  }
  
  if (userData.email) {
    userEmailEl.textContent = userData.email;
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
    // Clear the token from storage
    await chrome.storage.local.remove('access_token');
    // Show login view
    showView('login');
  } catch (error) {
    console.error('Error during logout:', error);
  }
}

// Google OAuth helper
async function startGoogleOAuth() {
  try {
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    // Prefer direct Supabase authorize URL so user goes straight to Google without an intermediate page
    const supabaseUrl = (window.promptokConfig && window.promptokConfig.SUPABASE_URL)
      ? window.promptokConfig.SUPABASE_URL
      : null;
    const redirectTo = `${base}/auth/callback`;

    if (supabaseUrl) {
      const params = new URLSearchParams({
        provider: 'google',
        redirect_to: redirectTo,
        flow_type: 'implicit',
        // These help with Google account picking and refresh support
        access_type: 'offline',
        prompt: 'select_account',
      });
      const authUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize?${params.toString()}`;
      chrome.tabs.create({ url: authUrl });
    } else {
      // Fallback to first-party start page
      const url = `${base}/auth/start?provider=google&redirectTo=${encodeURIComponent(redirectTo)}`;
      chrome.tabs.create({ url });
    }
    // Close popup after opening the tab
    window.close();
  } catch (e) {
    console.error('Google OAuth start error', e);
    showError(statusEl || signupStatusEl, 'Google sign-in failed to start');
  }
}

// Initialize event listeners
function initEventListeners() {
  // Add ripple effect to all buttons
  const buttons = document.querySelectorAll('.btn:not(.btn-text)');
  buttons.forEach(button => {
    button.addEventListener('click', createRipple);
  });
  
  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('click', handleLogin);
  }
  
  // Signup form submission
  if (signupForm) {
    signupForm.addEventListener('click', handleSignup);
  }
  
  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  // Google buttons
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', (e) => { e.preventDefault(); startGoogleOAuth(); });
  }
  if (googleLoginSignupBtn) {
    googleLoginSignupBtn.addEventListener('click', (e) => { e.preventDefault(); startGoogleOAuth(); });
  }
  
  // Toggle views
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showView('signup');
    });
  }
  
  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showView('login');
    });
  }
}

// Toggle between views
function showView(view) {
  // Hide all views first
  if (loginView) loginView.style.display = 'none';
  if (signupView) signupView.style.display = 'none';
  if (loggedInView) loggedInView.style.display = 'none';
  
  // Clear status messages
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }
  
  if (signupStatusEl) {
    signupStatusEl.textContent = '';
    signupStatusEl.className = 'status';
  }
  
  // Show the requested view
  switch(view) {
    case 'login':
      if (loginView) loginView.style.display = 'block';
      break;
    case 'signup':
      if (signupView) signupView.style.display = 'block';
      break;
    case 'loggedIn':
      if (loggedInView) loggedInView.style.display = 'block';
      break;
    default:
      if (loginView) loginView.style.display = 'block';
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

  // (Removed duplicate event listeners; initEventListeners handles bindings)

async function handleSignup(e) {
  e.preventDefault();
  
  const displayName = (document.getElementById('displayName')?.value || '').trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // Validation
  if (!displayName) {
    showError(signupStatusEl, 'Please enter your full name');
    return;
  }
  if (!email) {
    showError(signupStatusEl, 'Please enter your email');
    return;
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    showError(signupStatusEl, 'Please enter a valid email address');
    return;
  }
  if (!password) {
    showError(signupStatusEl, 'Please enter a password');
    return;
  }
  if (password.length < 8) {
    showError(signupStatusEl, 'Password must be at least 8 characters');
    return;
  }
  if (password !== confirmPassword) {
    showError(signupStatusEl, 'Passwords do not match');
    return;
  }
  
  try {
    setLoading(signupForm, true);
    
    const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
      ? await window.promptokConfig.getApiBase()
      : 'http://localhost:3000';
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: displayName,
      }),
    });
    
    const data = await res.json().catch(() => ({}));
    
    if (res.ok) {
      if (data.access_token) {
        // Auto-login if token is returned
        await chrome.runtime.sendMessage({ 
          type: 'SET_TOKEN', 
          token: data.access_token 
        });
        
        showSuccess(signupStatusEl, 'Account created! Redirecting...');
        
        // Open dashboard after a short delay
        setTimeout(async () => {
          try {
            const base = (window.promptokConfig && typeof window.promptokConfig.getApiBase === 'function')
              ? await window.promptokConfig.getApiBase()
              : 'http://localhost:3000';
            chrome.tabs.create({ url: `${base}/dashboard` });
          } catch (_e) {
            chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
          }
          window.close();
        }, 1000);
      } else {
        // If no token, show success message and switch to login
        showSuccess(signupStatusEl, 'Account created! Please check your email to verify your account.');
        setTimeout(() => showView('login'), 2000);
      }
    } else {
      const errorMsg = data.error || data.message || `Status: ${res.status}`;
      showError(signupStatusEl, `Signup failed: ${errorMsg}`);
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    showError(signupStatusEl, 'An error occurred. Please try again.');
  } finally {
    setLoading(signupForm, false);
  }
}
