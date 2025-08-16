async function handleLogin() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const statusEl = document.getElementById('status');
  const loginBtn = document.getElementById('login');
  const email = emailEl?.value || '';
  const password = passEl?.value || '';
  try {
    if (loginBtn) loginBtn.disabled = true;
    statusEl.textContent = 'Signing in...';
    const base = 'http://localhost:3000'; // Always use localhost in development
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const raw = await res.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (_) {
      console.error('Login error:', raw);
      throw new Error(`Server error (${res.status}): ${raw?.includes('DEPLOYMENT_NOT_FOUND') ? 'Local server not running' : raw?.slice(0, 120)}`);
    }
    if (res.ok && data && data.access_token) {
      // Store the token and notify the dashboard
      await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.access_token });
      statusEl.textContent = 'Logged in';
      if (passEl) passEl.value = '';
      
      // Open the dashboard in a new tab if not already open
      const tabs = await chrome.tabs.query({ url: 'http://localhost/*/dashboard*' });
      if (tabs.length === 0) {
        chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
      } else {
        // Focus the existing dashboard tab
        chrome.tabs.update(tabs[0].id, { active: true });
      }
    } else {
      statusEl.textContent = `Login failed: ${data?.error || res.status}`;
    }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e);
    statusEl.textContent = `Error connecting to API: ${msg}`;
  } finally {
    if (loginBtn) loginBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('login');
  if (btn) btn.addEventListener('click', handleLogin);
  const signupBtn = document.getElementById('signup');
  if (signupBtn) signupBtn.addEventListener('click', handleSignup);
});

async function handleSignup() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const statusEl = document.getElementById('status');
  const signupBtn = document.getElementById('signup');
  const email = emailEl?.value || '';
  const password = passEl?.value || '';
  try {
    if (signupBtn) signupBtn.disabled = true;
    statusEl.textContent = 'Signing up...';
    const base = 'http://localhost:3000'; // Always use localhost in development
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const raw = await res.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (_) {
      console.error('Signup error:', raw);
      throw new Error(`Server error (${res.status}): ${raw?.includes('DEPLOYMENT_NOT_FOUND') ? 'Local server not running' : raw?.slice(0, 120)}`);
    }
    if (res.ok) {
      if (data && data.access_token) {
        await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.access_token });
        statusEl.textContent = 'Signed up and logged in';
      } else {
        statusEl.textContent = data?.message || 'Signup successful. Check your email to confirm.';
      }
      if (passEl) passEl.value = '';
    } else {
      statusEl.textContent = `Signup failed: ${data?.error || res.status}`;
    }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e);
    statusEl.textContent = `Error connecting to API: ${msg}`;
  } finally {
    if (signupBtn) signupBtn.disabled = false;
  }
}


