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
  function addOverlayStyles(overlay) {
    try {
      if (!overlay) return false;
      // Idempotent: only add once
      if (overlay.querySelector('style[data-promptok-overlay-styles="1"]')) return true;
      const style = document.createElement('style');
      style.setAttribute('data-promptok-overlay-styles', '1');
      style.textContent = `
        .promptok-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          animation: fadeInDark 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeInDark {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(25px); }
        }

        .promptok-card {
          background: linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border-radius: 20px;
          padding: 28px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow:
            0 25px 50px rgba(0, 0, 0, 0.6),
            0 12px 24px rgba(0, 112, 243, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(0, 112, 243, 0.2);
          animation: slideInDark 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        @keyframes slideInDark {
          from {
            transform: translateY(30px) scale(0.96);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .promptok-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(0, 112, 243, 0.1);
        }

        .promptok-header h4 {
          margin: 0;
          color: #ffffff;
          font-size: calc(18px * var(--promptok-font-scale, 1));
          font-weight: 600;
          background: linear-gradient(135deg, #00f0ff 0%, #667eea 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.025em;
          text-shadow: 0 0 20px rgba(0, 112, 243, 0.3);
        }

        .promptok-close {
          background: rgba(255, 59, 48, 0.1);
          border: 1px solid rgba(255, 59, 48, 0.2);
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          color: #ff6b6b;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-weight: 600;
        }

        .promptok-close:hover {
          background: rgba(255, 59, 48, 0.2);
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(255, 59, 48, 0.3);
        }

        .promptok-loading { text-align: center; padding: 40px 20px; }

        .loading-spinner {
          width: 40px; height: 40px;
          border: 2px solid rgba(0, 112, 243, 0.1);
          border-top: 2px solid #00f0ff;
          border-right: 2px solid #667eea;
          border-radius: 50%;
          animation: spinNeon 1s linear infinite;
          margin: 0 auto 20px;
          box-shadow: 0 0 20px rgba(0, 112, 243, 0.3);
        }

        @keyframes spinNeon { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .promptok-actions {
          display: flex; gap: 12px; margin-top: 24px; align-items: center;
        }

        .promptok-actions button {
          flex: 1; padding: 12px 20px; border-radius: 12px; font-weight: 500; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); font-size: calc(14px * var(--promptok-font-scale, 1));
          letter-spacing: -0.025em;
        }

        .promptok-actions button.primary {
          background: linear-gradient(135deg, #00f0ff 0%, #667eea 100%);
          color: #000; border: 1px solid rgba(0, 112, 243, 0.3);
          font-weight: 600; box-shadow: 0 6px 20px rgba(0, 112, 243, 0.3);
        }
        .promptok-actions button.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 112, 243, 0.4); }

        .promptok-actions button.copy-icon {
          width: 40px; height: 40px; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(0, 112, 243, 0.2); border-radius: 10px; color: #00f0ff;
          font-size: calc(14px * var(--promptok-font-scale, 1)); display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; flex-shrink: 0; backdrop-filter: blur(10px);
        }
        .promptok-actions button.copy-icon:hover { background: rgba(0, 112, 243, 0.1); color: #00f0ff; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 112, 243, 0.3); border-color: rgba(0, 112, 243, 0.4); }

        .promptok-actions button.secondary { background: rgba(255, 255, 255, 0.05); color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); }
        .promptok-actions button.secondary:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-1px); }

        .promptok-status { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; backdrop-filter: blur(10px); }
        .promptok-status.success { background: rgba(34, 197, 94, 0.1); color: #22f055; border: 1px solid rgba(34, 197, 94, 0.2); }

        .error-message { padding: 20px 0; text-align: center; color: #ff6b6b; }
      `;
      overlay.appendChild(style);
      return true;
    } catch (_) {
      return false;
    }
  }

  function addEnhancedStyles(overlay) {
    try {
      if (!overlay) return false;
      if (overlay.querySelector('style[data-promptok-enhanced-styles="1"]')) return true;
      const style = document.createElement('style');
      style.setAttribute('data-promptok-enhanced-styles', '1');
      style.textContent = `
        .promptok-card.enhanced {
          background: linear-gradient(180deg, rgba(0, 112, 243, 0.12), rgba(0, 112, 243, 0.06));
          border: 1px solid rgba(0, 112, 243, 0.25);
          border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.35);
          padding: 18px; color: #ffffff;
          font-size: calc(14px * var(--promptok-font-scale, 1));
        }

        .promptok-card.enhanced .promptok-header {
          display: flex; justify-content: space-between; align-items: center;
          background: rgba(147, 51, 234, 0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(147, 51, 234, 0.15);
          padding: 20px 24px 16px; margin: 0;
        }

        .promptok-card.enhanced .promptok-header h4 {
          color: white; text-shadow: 0 0 20px rgba(0, 112, 243, 0.4); margin: 0;
          font-size: calc(22px * var(--promptok-font-scale, 1)); font-weight: 700; letter-spacing: -0.03em;
          background: linear-gradient(135deg, #a855f7 0%, #ffffff 50%, #c084fc 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .header-controls { display: flex; gap: 10px; align-items: center; }
        .font-scale-controls { position: relative; display: inline-flex; overflow: visible; }
        .font-scale-controls .font-trigger {
          color: rgba(255,255,255,0.9); width: 36px; height: 36px; border-radius: 999px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        .font-scale-controls .font-trigger:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
        .font-scale-controls .font-icon { display: block; opacity: 0.9; }
        .font-scale-controls .font-popover {
          position: absolute; top: 36px; right: 0; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px;
          background: linear-gradient(135deg, rgba(196,132,252,0.12), rgba(147,51,234,0.1));
          border: 1px solid rgba(196,132,252,0.25); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          opacity: 0; pointer-events: none; transform: translateY(-2px); transition: opacity .15s ease, transform .15s ease; z-index: 2;
        }
        .font-scale-controls:hover .font-popover,
        .font-scale-controls.open .font-popover { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .font-scale-controls .font-scale-display { color: rgba(255,255,255,0.85); font-size: calc(12px * var(--promptok-font-scale, 1)); min-width: 48px; text-align: center; }
        .font-scale-controls .font-decrease,
        .font-scale-controls .font-increase {
          color: rgba(255, 255, 255, 0.9); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;
        }
        .font-scale-controls .font-decrease:hover,
        .font-scale-controls .font-increase:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }

        .promptok-card.enhanced .promptok-minimize,
        .promptok-card.enhanced .promptok-close {
          color: rgba(255, 255, 255, 0.8); background: rgba(0, 112, 243, 0.1); border: 1px solid rgba(0, 112, 243, 0.2);
          width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); font-size: 18px; font-weight: 600; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        .promptok-card.enhanced .promptok-minimize:hover,
        .promptok-card.enhanced .promptok-close:hover { background: rgba(0, 112, 243, 0.2); color: white; transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 24px rgba(0, 112, 243, 0.3); }

        .enhanced-prompt-preview {
          margin: 20px 24px; padding: 20px; background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-radius: 16px; border: 1px solid rgba(0, 112, 243, 0.1);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          animation: previewGlow 0.5s cubic-bezier(0.16, 1, 0.3, 1); animation-delay: 0.1s; animation-fill-mode: both;
        }
        @keyframes previewGlow { from { transform: translateY(20px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

        .enhanced-prompt-preview h5 { margin: 0 0 14px 0; color: white; font-size: calc(15px * var(--promptok-font-scale, 1)); font-weight: 600; letter-spacing: -0.025em; text-shadow: 0 0 10px rgba(0, 112, 243, 0.3); }

        .prompt-text {
          background: rgba(0, 0, 0, 0.3); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(0, 112, 243, 0.2);
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; font-size: calc(13px * var(--promptok-font-scale, 1)); line-height: 1.5; color: #00f0ff;
          max-height: 120px; overflow-y: auto;
        }
      `;
      overlay.appendChild(style);
      return true;
    } catch (_) {
      return false;
    }
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
