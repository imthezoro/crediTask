// PromptOK Content Script Constants (Phase 1)
// Exposes constants via a single global namespace without changing existing behavior.

(function() {
  'use strict';
  if (window.PromptOK_CONSTS) return; // idempotent

  window.PromptOK_CONSTS = Object.freeze({
    classes: Object.freeze({
      floatingButton: 'promptok-floating-button',
      overlay: 'promptok-overlay',
      minimizedButton: 'promptok-minimized-button',
      chatGptPanel: 'promptok-chatgpt-panel',
      cardEnhanced: 'promptok-card',
      tooltip: 'promptok-tooltip',
    }),
    storageKeys: Object.freeze({
      session: 'promptok.session',
      fontScale: 'promptok.fontScale',
    }),
    zIndex: 2147483647,
    buttonSize: 32,
    fontScale: { min: 0.8, max: 1.8, step: 0.1, default: 1.1 },
  });
})();
