// PromptOK Content Script - Per-site Style Helpers
// Applies site-specific classes to overlay/document for CSS targeting.

(function() {
  'use strict';
  if (window.PromptOK_Styles) return; // idempotent

  function getSiteClasses(flags) {
    const classes = [];
    if (!flags) return classes;
    if (flags.isGPT) classes.push('promptok-site-gpt');
    if (flags.isClaude) classes.push('promptok-site-claude');
    if (flags.isPerplexity) classes.push('promptok-site-perplexity');
    if (flags.isGemini) classes.push('promptok-site-gemini');
    return classes;
  }

  function applyOverlaySiteClasses(overlay, flags) {
    if (!overlay || !flags) return;
    const classes = getSiteClasses(flags);
    classes.forEach(cls => overlay.classList.add(cls));
  }

  function applyDocumentSiteClasses(flags) {
    if (!flags) return;
    const classes = getSiteClasses(flags);
    const root = document.documentElement;
    classes.forEach(cls => root.classList.add(cls));
  }

  window.PromptOK_Styles = {
    getSiteClasses,
    applyOverlaySiteClasses,
    applyDocumentSiteClasses,
  };
})();
