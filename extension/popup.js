async function handleLogin() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const statusEl = document.getElementById('status');
  const email = emailEl?.value || '';
  const password = passEl?.value || '';
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.access_token });
      statusEl.textContent = 'Logged in';
    } else {
      statusEl.textContent = 'Login failed';
    }
  } catch (e) {
    statusEl.textContent = 'Error';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('login');
  if (btn) btn.addEventListener('click', handleLogin);
});


