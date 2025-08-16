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
      // Store the token and notify the background script
      await chrome.runtime.sendMessage({ 
        type: 'SET_TOKEN', 
        token: data.access_token 
      });
      
      showSuccess(statusEl, 'Login successful! Redirecting...');
      
      // Open or focus dashboard
      const tabs = await chrome.tabs.query({ 
        url: 'http://localhost:3000/dashboard*' 
      });
      
      if (tabs.length === 0) {
        chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
      } else {
        chrome.tabs.update(tabs[0].id, { active: true });
      }
      
      // Close the popup after a short delay
      setTimeout(() => window.close(), 1000);
      
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
const loginForm = document.getElementById('login');
const signupForm = document.getElementById('signup');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const statusEl = document.getElementById('status');
const signupStatusEl = document.getElementById('signupStatus');

// Toggle between login and signup views
function showView(view) {
  if (view === 'login') {
    loginView.style.display = 'block';
    signupView.style.display = 'none';
    statusEl.textContent = '';
    statusEl.className = 'status';
  } else {
    loginView.style.display = 'none';
    signupView.style.display = 'block';
    signupStatusEl.textContent = '';
    signupStatusEl.className = 'status';
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

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Show login view by default
  showView('login');
  
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
});

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
