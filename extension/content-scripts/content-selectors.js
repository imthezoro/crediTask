// PromptOK Content Script - Site Selectors (Phase 1)
// Provides selector lists for different hosts. No side effects.

(function() {
  'use strict';
  if (window.PromptOK_Selectors) return; // idempotent

  function getSiteSpecificSelectors(hostname, url) {
    const selectors = [];
    const host = (hostname || '').toLowerCase();
    const href = (url || '').toLowerCase();

    if (host.includes('openai.com') || host.includes('chatgpt.com') || href.includes('chat.openai.com')) {
      selectors.push(
        'textarea[data-id="root"]',
        '#prompt-textarea',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="send a message" i]',
        'div[contenteditable="true"][data-testid="composer-text-input"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea'
      );
    } else if (host.includes('claude.ai')) {
      selectors.push(
        'div[contenteditable="true"][data-testid="chat-input"]',
        'div[contenteditable="true"] p',
        'div[contenteditable="true"][role="textbox"]'
      );
    } else if (host.includes('perplexity.ai')) {
      selectors.push(
        'textarea[placeholder*="ask anything" i]',
        'textarea[placeholder*="ask follow-up" i]',
        'textarea[placeholder*="search" i]',
        'textarea[placeholder*="ask" i]',
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        '[role="textbox"]',
        '[data-slate-editor="true"]',
        'div[contenteditable="true"][data-slate-editor="true"]',
        'div[contenteditable="true"][data-lexical-editor]',
        '[data-testid*="editor" i]',
        'div[contenteditable="true"][data-testid*="search" i]',
        'div[contenteditable="true"][aria-label*="ask" i]',
        'textarea'
      );
    } else if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
      selectors.push(
        'textarea[placeholder*="enter a prompt" i]',
        'div[contenteditable="true"][aria-label*="message" i]',
        'textarea[jsname]'
      );
    }

    return selectors;
  }

  window.PromptOK_Selectors = { getSiteSpecificSelectors };
})();
