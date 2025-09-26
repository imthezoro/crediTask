// PromptOK Content Script - Auth Bridge Helpers (Phase 1)
// Lightweight wrappers over background/offscreen messaging for JWT.

(function() {
  'use strict';
  if (window.PromptOK_Auth) return; // idempotent

  async function getExtensionJWT() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_EXTENSION_JWT' });
      return res || { jwt: null, expiresAt: null };
    } catch (e) {
      console.warn('[PromptOK_Auth] GET_EXTENSION_JWT failed', e);
      return { jwt: null, expiresAt: null, error: e && e.message };
    }
  }

  async function refreshExtensionJWT() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'REFRESH_EXTENSION_JWT' });
      return res || { ok: false };
    } catch (e) {
      console.warn('[PromptOK_Auth] REFRESH_EXTENSION_JWT failed', e);
      return { ok: false, error: e && e.message };
    }
  }

  window.PromptOK_Auth = { getExtensionJWT, refreshExtensionJWT };
})();
