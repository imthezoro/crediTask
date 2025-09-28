// PromptOK Content Script - Per-site Configuration (ChatGPT, Claude, Perplexity, Gemini)
// Provides site flags and UI offsets in a single place. No side effects.

(function() {
  'use strict';
  if (window.PromptOK_Config) return; // idempotent

  function detectSite(hostname) {
    const host = (hostname || (window.location && window.location.hostname) || '').toLowerCase();
    return {
      isGPT: host.includes('openai.com') || host.includes('chatgpt.com') || host.includes('chat.openai.com'),
      isClaude: host.includes('claude.ai'),
      isPerplexity: host.includes('perplexity.ai'),
      isGemini: host.includes('gemini.google.com') || host.includes('bard.google.com'),
    };
  }

  function getOffsets(flags) {
    // Centralize button offsets per site; keep identical to current behavior
    if (flags.isGPT) return { right: 100, bottom: 12 };
    if (flags.isClaude) return { right: 180, bottom: 12 };
    if (flags.isPerplexity) return { right: 60, bottom: 12 };
    if (flags.isGemini) return { right: 80, bottom: 12 };
    return { right: 60, bottom: 12 };
  }

  function getSiteConfig(hostname) {
    const flags = detectSite(hostname);
    const offsets = getOffsets(flags);
    return { flags, offsets };
  }

  function getSiteName(hostname) {
    const flags = detectSite(hostname);
    if (flags.isGPT) return 'gpt';
    if (flags.isClaude) return 'claude';
    if (flags.isPerplexity) return 'perplexity';
    if (flags.isGemini) return 'gemini';
    return 'unknown';
  }

  window.PromptOK_Config = {
    detectSite,
    getSiteConfig,
    getSiteName,
  };
})();
