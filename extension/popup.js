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
    
    const base = 'http://localhost:3000';
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
      
      // Load user profile and update UI
      await loadUserProfile();
      showView('loggedIn');
      
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

// Check authentication status when popup loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded, checking auth status...');
  try {
    // Check if user is already authenticated
    const result = await chrome.storage.local.get('access_token');
    console.log('Storage result:', result);
    const access_token = result.access_token;
    
    if (access_token) {
      console.log('Found access token, showing logged in view');
      // User is logged in, show the logged-in view
      showView('loggedIn');
      // Fetch and display user profile
      await loadUserProfile();
    } else {
      console.log('No access token found, showing login view');
      // User is not logged in, show login view by default
      showView('login');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    showView('login');
  }
  
  // Initialize other event listeners
  initEventListeners();
});

// Load user profile data
async function loadUserProfile() {
  try {
    const { access_token } = await chrome.storage.local.get('access_token');
    if (!access_token) return;
    
    const base = 'http://localhost:3000';
    const res = await fetch(`${base}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (res.ok) {
      const userData = await res.json();
      updateUserProfile(userData);
    } else {
      // If token is invalid, clear it and show login
      await chrome.storage.local.remove('access_token');
      showView('login');
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Update the UI with user profile data
function updateUserProfile(userData) {
  if (userData.name) {
    userNameEl.textContent = userData.name;
  } else if (userData.firstName || userData.lastName) {
    userNameEl.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  } else {
    userNameEl.textContent = 'User';
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

async function handleSignup(e) {
  e.preventDefault();
  
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // Validation
  if (!firstName) {
    showError(signupStatusEl, 'Please enter your first name');
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
    
    const base = 'http://localhost:3000';
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName
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
        setTimeout(() => {
          chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
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
