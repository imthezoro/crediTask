// PromptOK Content Script - State/Storage Helpers (Phase 1)
// Provides unified storage helpers compatible with chrome.storage.local and localStorage.

(function() {
  'use strict';
  if (window.PromptOK_State) return; // idempotent

  async function setItem(key, value) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [key]: value });
      } else if (window.localStorage) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('[PromptOK_State] setItem failed', key, e);
    }
  }

  async function getItem(key) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const out = await chrome.storage.local.get([key]);
        return out && out[key];
      } else if (window.localStorage) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {
      console.warn('[PromptOK_State] getItem failed', key, e);
    }
    return null;
  }

  async function removeItem(key) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(key);
      } else if (window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[PromptOK_State] removeItem failed', key, e);
    }
  }

  window.PromptOK_State = { setItem, getItem, removeItem };
})();
