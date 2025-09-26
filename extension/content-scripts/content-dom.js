// PromptOK Content Script - DOM Helpers (Phase 1)
// Pure helpers with no side effects. Existing code can adopt these later.

(function() {
  'use strict';
  if (window.PromptOK_DOM) return; // idempotent

  function queryDeepAll(selector, root = document) {
    const out = [];
    const traverse = (node) => {
      try {
        if (!node) return;
        const matches = node.querySelectorAll ? node.querySelectorAll(selector) : [];
        matches && matches.forEach && matches.forEach((el) => out.push(el));
        const tree = node.querySelectorAll ? node.querySelectorAll('*') : [];
        tree && tree.forEach && tree.forEach((el) => {
          if (el.shadowRoot) traverse(el.shadowRoot);
        });
      } catch (_) { /* ignore */ }
    };
    traverse(root);
    return out;
  }

  function isValidInput(element) {
    if (!element) return false;
    try {
      const style = window.getComputedStyle(element);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && element.offsetWidth > 0 && element.offsetHeight > 0;
      const isInteractable = !element.disabled && !element.readOnly;
      const isTextarea = element.tagName === 'TEXTAREA';
      const isContentEditable = element.getAttribute && (element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox');
      return isVisible && isInteractable && (isTextarea || isContentEditable);
    } catch (_) { return false; }
  }

  function findClosestNonScrollableAncestor(el) {
    try {
      let node = el && el.parentElement;
      while (node && node !== document.body) {
        const cs = window.getComputedStyle(node);
        const overflowY = cs.overflowY;
        const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
        if (!isScrollable) return node;
        node = node.parentElement;
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  function findGeminiAnchor(el) {
    try {
      const isToolbarish = (node) => {
        if (!node || !node.classList) return false;
        const cls = Array.from(node.classList).join(' ');
        return (
          cls.includes('leading-actions-wrapper') ||
          cls.includes('toolbox-drawer') ||
          cls.includes('uploader') ||
          cls.includes('uploader-button-container')
        );
      };
      let node = el && el.parentElement;
      let lastNonScrollable = null;
      while (node && node !== document.body) {
        try {
          const cs = window.getComputedStyle(node);
          const overflowY = cs.overflowY;
          const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
          if (!isScrollable) lastNonScrollable = node;
          if (isToolbarish(node)) {
            return lastNonScrollable || node.parentElement || document.body;
          }
        } catch (_) { /* ignore */ }
        node = node.parentElement;
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  window.PromptOK_DOM = {
    queryDeepAll,
    isValidInput,
    findClosestNonScrollableAncestor,
    findGeminiAnchor,
  };
})();
