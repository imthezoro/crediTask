// PromptOK Content Script - UI Helpers (Phase 1)
// Stateless helpers that create DOM nodes but do not attach them. Styling remains inline like current impl.

(function() {
  'use strict';
  if (window.PromptOK_UI) return; // idempotent

  function createEnhanceButton({ inputId, zIndex = 2147483647, size = 32 }) {
    const button = document.createElement('button');
    button.className = 'promptok-floating-button promptok-enhance-button';
    button.setAttribute('aria-label', 'Enhance prompt with AI');
    if (inputId) button.setAttribute('data-input-id', inputId);

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L15.09 8.26L22 9L17 14.74L18.18 22L12 18.27L5.82 22L7 14.74L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
        <path d="M12 7L14.09 12.26L19 13L15 16.74L16.18 21L12 17.77L7.82 21L9 16.74L5 13L9.91 12.26L12 7Z" fill="currentColor" opacity="0.6"/>
      </svg>
    `;
    try { button.removeAttribute('title'); } catch (_) {}

    const s = (prop, val) => button.style.setProperty(prop, val, 'important');
    s('position', 'absolute');
    s('width', `${size}px`);
    s('height', `${size}px`);
    s('z-index', String(zIndex));
    s('display', 'flex');
    s('align-items', 'center');
    s('justify-content', 'center');
    s('cursor', 'pointer');
    s('border-radius', '12px');
    s('border', '1px solid rgba(255, 255, 255, 0.15)');
    s('background', 'linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(20, 20, 30, 0.9) 100%)');
    s('backdrop-filter', 'blur(20px)');
    s('box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 112, 243, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)');
    s('color', '#00f0ff');
    s('font-size', '16px');
    s('font-weight', '600');
    s('transition', 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)');
    s('line-height', '1');
    s('text-shadow', '0 0 8px rgba(0, 112, 243, 0.6)');

    return button;
  }

  function ensureTooltip(button) {
    let tip = button._promptokTooltip;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'promptok-tooltip';
      tip.textContent = '';
      button.appendChild(tip);
      button._promptokTooltip = tip;
    }
    return tip;
  }

  function updateButtonTooltip(button, text, show) {
    try {
      const tip = ensureTooltip(button);
      if (typeof text === 'string') tip.textContent = text;
      if (show) tip.classList.add('show'); else tip.classList.remove('show');
    } catch (_) {}
  }

  function setButtonLoading(button, isLoading, message = 'Enhancing…') {
    try {
      if (!button) return;
      if (isLoading) {
        button.classList.add('loading');
        button.setAttribute('aria-busy', 'true');
        button.dataset.loading = 'true';
        button.style.setProperty('pointer-events', 'auto', 'important');
        button._promptokTooltipText = message;
        updateButtonTooltip(button, '', false);
      } else {
        button.classList.remove('loading');
        button.removeAttribute('aria-busy');
        delete button.dataset.loading;
        button._promptokTooltipText = '';
        updateButtonTooltip(button, '', false);
      }
    } catch (_) {}
  }

  // ----- Generic overlay/status/toast helpers (Phase 2b) -----
  function ensureOverlay() {
    let overlay = document.querySelector('.promptok-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'promptok-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function ensureStatus(overlay) {
    let statusEl = overlay.querySelector('.promptok-status');
    if (!statusEl) {
      const card = overlay.querySelector('.promptok-card');
      statusEl = document.createElement('div');
      statusEl.className = 'promptok-status';
      if (card) card.appendChild(statusEl); else overlay.appendChild(statusEl);
    }
    return statusEl;
  }

  function setStatus(overlay, message, type) {
    const statusEl = ensureStatus(overlay);
    statusEl.textContent = message;
    statusEl.className = `promptok-status ${type || ''}`.trim();
  }

  function showToast(message, opts = {}) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      padding: '10px 14px',
      borderRadius: '10px',
      background: opts.bg || 'rgba(255, 71, 87, 0.15)',
      color: opts.color || '#ff6b6b',
      border: opts.border || '1px solid rgba(255, 71, 87, 0.3)',
      backdropFilter: 'blur(10px)',
      zIndex: String(2147483647),
      fontSize: '13px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), opts.timeout || 2500);
  }

  function showGenericError(message) {
    const overlay = document.querySelector('.promptok-overlay');
    if (overlay) {
      setStatus(overlay, `⚠️ ${message}`, 'error');
    } else {
      showToast(`⚠️ ${message}`);
    }
  }

  function showGenericSuccess(message) {
    const overlay = document.querySelector('.promptok-overlay');
    if (overlay) {
      setStatus(overlay, message, 'success');
    } else {
      showToast(`✅ ${message}`, { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' });
    }
  }

  function removeOverlay() {
    const overlay = document.querySelector('.promptok-overlay');
    if (overlay) {
      try { overlay.style.opacity = '0'; } catch (_) {}
      setTimeout(() => { try { overlay.remove(); } catch (_) {} }, 400);
    }
  }

  // Style injection scaffolding: return true if handled (to skip internal style injection)
  function addOverlayStyles(_overlay) {
    // Currently no-op: we rely on existing inline styles in enhanced-content.js
    // Future: move styles to CSS and implement here. Returning false will trigger fallback.
    return false;
  }

  function addEnhancedStyles(_overlay) {
    // Currently no-op, see addOverlayStyles comment
    return false;
  }

  window.PromptOK_UI = {
    createEnhanceButton,
    updateButtonTooltip,
    setButtonLoading,
    ensureOverlay,
    ensureStatus,
    setStatus,
    showToast,
    showGenericError,
    showGenericSuccess,
    removeOverlay,
    addOverlayStyles,
    addEnhancedStyles,
  };
})();
