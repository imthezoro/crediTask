(function () {
  // Always use localhost in development
  const DEFAULT_PRODUCTION_BASE = 'http://localhost:3000';
  const DEFAULT_LOCAL_BASE = 'http://localhost:3000';
  const DETECTION_TTL_MS = 300000; // 5 minutes
  let inFlightDetectionPromise = null;

  // Supabase configuration (from .env)
  // Replace with your actual environment values
  const SUPABASE_URL = 'https://coqwcumwpixmrjqnmhkv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcXdjdW13cGl4bXJqcW5taGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTUwMzgsImV4cCI6MjA3MDU5MTAzOH0.sBGwoRxaYpyE2EmyjHxSmlxuOGITxw8kVSthlSLigME';

  async function detectLocalServerAlive() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 700);
    try {
      const res = await fetch(`${DEFAULT_LOCAL_BASE}/api/auth/login`, {
        method: 'OPTIONS',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 204;
    } catch (_e) {
      clearTimeout(timeoutId);
      return false;
    }
  }

  async function getApiBase() {
    // Always return localhost:3000 in development
    return 'http://localhost:3000';
    
    // The following code is kept for reference but not used in development
    /*
    try {
      const { api_base, api_base_expires } = await chrome.storage.local.get([
        'api_base',
        'api_base_expires',
      ]);
      const now = Date.now();
      if (api_base && typeof api_base_expires === 'number' && api_base_expires > now) {
        return api_base;
      }
    } catch (_e) {
      // ignore storage read errors and continue
    }

    if (!inFlightDetectionPromise) {
      inFlightDetectionPromise = (async () => {
        const isLocalUp = await detectLocalServerAlive();
        const base = isLocalUp ? DEFAULT_LOCAL_BASE : DEFAULT_PRODUCTION_BASE;
        const expires = Date.now() + DETECTION_TTL_MS;
        try {
          await chrome.storage.local.set({ api_base: base, api_base_expires: expires });
        } catch (_e) {
          // ignore storage write errors
        }
        return base;
      })().finally(() => {
        inFlightDetectionPromise = null;
      });
    }
    */
    return inFlightDetectionPromise;
  }

  window.promptokConfig = {
    getApiBase,
    DEFAULT_LOCAL_BASE: DEFAULT_LOCAL_BASE,
    DEFAULT_PRODUCTION_BASE: DEFAULT_PRODUCTION_BASE,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  };
})();


