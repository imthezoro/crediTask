class AdvancedPromptEnhancer {
  constructor() {
    this.currentEnhancementData = null;
    this.selectedOptions = new Set();
    // Use a distinct class to avoid overlay.css '!important' rules meant for in-DOM buttons
    this.buttonClass = 'promptok-floating-button';
    this.overlayClass = 'promptok-overlay';
    this.isMinimized = false;
    this.minimizedButtonClass = 'promptok-minimized-button';
    this.sessionStorageKey = 'promptok.session';
    this.userProfile = null;
    this.isAuthenticated = false;
    this.currentInput = null;
    this.processedInputs = new Set();
    this.floatingButtons = new Map(); // inputEl -> buttonEl
    this._repositionBound = null;
    this._mutationObserver = null;
    
    // Debug mode - set to true for detailed logging
    this.debug = true;
    
    // Initialize authentication check
    this.initializeAuth();
    
    // Clean up orphaned buttons on initialization
    this.cleanupOrphanedButtons();

    // Attach global listeners once for repositioning
    this.attachGlobalPositionListeners();
  }

  // Session persistence helpers
  async setStorageItem(key, value) {
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
      } else if (window.localStorage) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Failed to set storage item '${key}':`, error);
    }
  }

  async saveSessionState() {
    const payload = {
      currentEnhancementData: this.currentEnhancementData,
      selectedOptions: Array.from(this.selectedOptions || []),
      timestamp: Date.now()
    };
    this.debugLog('Saving session state to storage');
    await this.setStorageItem(this.sessionStorageKey, payload);
  }

  async clearSessionState() {
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.remove(this.sessionStorageKey);
      } else if (window.localStorage) {
        localStorage.removeItem(this.sessionStorageKey);
      }
    } catch (e) {
      /* ignore */
    }
  }

  async loadSessionState() {
    const data = await this.getStorageItem(this.sessionStorageKey);
    if (data) {
      this.debugLog('Loaded session state from storage');
      if (!this.currentEnhancementData && data.currentEnhancementData) {
        this.currentEnhancementData = data.currentEnhancementData;
      }
      if (data.selectedOptions?.length) {
        this.selectedOptions = new Set(data.selectedOptions);
      }
      return true;
    }
    return false;
  }

  debugLog(...args) {
    if (this.debug) {
      console.log('[PromptOK Debug]', ...args);
    }
  }

  // Initialize authentication and site validation
  async initializeAuth() {
    try {
      // Check if current site is allowed
      const isAllowed = await this.isCurrentSiteAllowed();
      if (!isAllowed) {
        this.debugLog('Current site not allowed, extension disabled');
        return;
      }

      // Check authentication status
      await this.checkAuthenticationStatus();
    } catch (error) {
      console.error('[PromptOK] Failed to initialize auth:', error);
    }
  }

  // Check if current site is in the allowed list
  async isCurrentSiteAllowed() {
    try {
      if (!window.promptokEnvConfig) {
        console.warn('[PromptOK] Environment config not loaded');
        return false;
      }
      
      const hostname = window.location.hostname;
      return await window.promptokEnvConfig.isAllowedSite(hostname);
    } catch (error) {
      console.error('[PromptOK] Error checking allowed site:', error);
      return false;
    }
  }

  // Check user authentication and profile
  async checkAuthenticationStatus() {
    try {
      const jwtData = await this.getExtensionJWT();
      if (!jwtData.jwt) {
        this.debugLog('User not authenticated');
        this.isAuthenticated = false;
        this.userProfile = null;
        return false;
      }
      // We consider the user authenticated if a JWT is available. Credits are enforced by API rate limits.
      this.isAuthenticated = true;
      this.userProfile = null;
      this.debugLog('User authenticated (JWT present)');
      return true;
    } catch (error) {
      console.error('[PromptOK] Error checking authentication:', error);
      this.isAuthenticated = false;
      this.userProfile = null;
      return false;
    }
  }

  // Get user profile from API
  async getUserProfile(jwt) {
    try {
      if (!window.promptokEnvConfig) {
        throw new Error('Environment configuration not loaded');
      }
      
      const baseUrl = await window.promptokEnvConfig.getApiBase();
      const response = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Profile request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[PromptOK] Error getting user profile:', error);
      return null;
    }
  }

  // Check if user has sufficient credits
  hasCredits() {
    if (!this.userProfile) return false;
    
    // Check if user has credits or usage remaining
    const credits = this.userProfile.credits || this.userProfile.usage_remaining || 0;
    return credits > 0;
  }

  // Show authentication required message
  showAuthRequired() {
    this.showError('Please sign in to PromptOK to use this feature. Click the extension icon to sign in.');
  }

  // Show insufficient credits message
  showInsufficientCredits() {
    const credits = this.userProfile?.credits || this.userProfile?.usage_remaining || 0;
    this.showError(`Insufficient credits (${credits} remaining). Please upgrade your plan to continue using prompt enhancement.`);
  }

  // Test function to debug apply functionality
  testApply() {
    this.debugLog('Testing apply functionality...');
    const testPrompt = "This is a test prompt to verify the apply button works.";
    this.applyPromptToInput(testPrompt);
  }

  getSiteSpecificSelectors() {
    const hostname = window.location.hostname;
    const url = window.location.href;
    const selectors = [];
    
    if (hostname.includes('openai.com') || hostname.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      // ChatGPT selectors - more comprehensive
      selectors.push(
        'textarea[data-id="root"]',
        '#prompt-textarea',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="send a message" i]',
        'div[contenteditable="true"][data-testid="composer-text-input"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea'
      );
    } else if (hostname.includes('claude.ai')) {
      // Claude selectors
      selectors.push(
        'div[contenteditable="true"][data-testid="chat-input"]',
        'div[contenteditable="true"] p',
        'div[contenteditable="true"][role="textbox"]'
      );
    } else if (hostname.includes('perplexity.ai')) {
      // Perplexity selectors - more comprehensive
      selectors.push(
        'textarea[placeholder*="ask anything" i]',
        'textarea[placeholder*="ask follow-up" i]',
        'textarea[placeholder*="search" i]',
        'textarea[placeholder*="ask" i]',
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        '[role="textbox"]',
        // Slate/Lexical editors commonly used by Perplexity
        '[data-slate-editor="true"]',
        'div[contenteditable="true"][data-slate-editor="true"]',
        'div[contenteditable="true"][data-lexical-editor]',
        '[data-testid*="editor" i]',
        'div[contenteditable="true"][data-testid*="search" i]',
        'div[contenteditable="true"][aria-label*="ask" i]',
        'textarea'
      );
    } else if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) {
      // Gemini/Bard selectors
      selectors.push(
        'textarea[placeholder*="enter a prompt" i]',
        'div[contenteditable="true"][aria-label*="message" i]',
        'textarea[jsname]'
      );
    }
    
    return selectors;
  }

  // Deep query across shadow roots
  queryDeepAll(selector, root = document) {
    const out = [];
    const traverse = (node) => {
      try {
        if (!node) return;
        // Regular matches in this root
        const matches = node.querySelectorAll ? node.querySelectorAll(selector) : [];
        matches && matches.forEach && matches.forEach((el) => out.push(el));
        // Traverse shadow roots
        const tree = node.querySelectorAll ? node.querySelectorAll('*') : [];
        tree && tree.forEach && tree.forEach((el) => {
          if (el.shadowRoot) traverse(el.shadowRoot);
        });
      } catch (_) {
        // ignore
      }
    };
    traverse(root);
    return out;
  }

  async detect() {
    // Check if site is allowed before proceeding
    const isAllowed = await this.isCurrentSiteAllowed();
    if (!isAllowed) {
      this.debugLog('Site not allowed, skipping detection');
      return null;
    }
    // Note: We no longer gate the button on auth/credits here.
    // Auth/credits are checked in startEnhancement() when user clicks the button.

    // Site-specific selectors with priority order
    const siteSelectors = this.getSiteSpecificSelectors();
    const genericSelectors = [
      // Most common patterns first
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="send a message" i]', 
      'textarea[placeholder*="type a message" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="type" i]',
      'textarea[placeholder*="enter" i]',
      'textarea[placeholder*="write" i]',
      // Contenteditable elements
      'div[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      // Fallback to any visible textarea
      'textarea:not([readonly]):not([disabled]):not([style*="display: none"]):not([hidden])',
      'input[type="text"]:not([readonly]):not([disabled]):not([style*="display: none"]):not([hidden])'
    ];
    
    const selectors = [...siteSelectors, ...genericSelectors];
    
    // Try each selector individually for better debugging
    let input = null;
    for (const selector of selectors) {
      try {
        // Search both light DOM and shadow DOM
        const elements = this.queryDeepAll(selector, document);
        // Prefer textareas first among matches, else first valid
        const sorted = Array.from(elements).sort((a, b) => (b.tagName === 'TEXTAREA') - (a.tagName === 'TEXTAREA'));
        for (const element of sorted) {
          if (this.isValidInput(element)) {
            input = element;
            console.log('Found input with selector:', selector, input);
            break;
          }
        }
        if (input) break;
      } catch (e) {
        this.debugLog('Selector failed:', selector, e);
      }
    }
    if (!input) {
      this.debugLog('No valid input found. Host:', window.location.hostname, 'Tried selectors count:', selectors.length);
    }
    
    if (input && !this.hasEnhanceButton(input)) {
      this.addEnhanceButton(input);
    }
    return input;
  }

  isValidInput(element) {
    if (!element) return false;
    try {
      const style = window.getComputedStyle(element);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && element.offsetWidth > 0 && element.offsetHeight > 0;
      const isInteractable = !element.disabled && !element.readOnly;
      const isTextarea = element.tagName === 'TEXTAREA';
      const isContentEditable = element.getAttribute && (element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox');
      return isVisible && isInteractable && (isTextarea || isContentEditable);
    } catch (e) {
      this.debugLog('Error validating input:', e);
      return false;
    }
  }

  hasEnhanceButton(input) {
    // Check if button already exists for this specific input
    const inputId = input.id || input.getAttribute('data-promptok-id') || this.generateInputId(input);
    if (!input.getAttribute('data-promptok-id')) {
      input.setAttribute('data-promptok-id', inputId);
    }
    return document.querySelector(`.${this.buttonClass}[data-input-id="${inputId}"]`) !== null;
  }

  generateInputId(input) {
    // Generate a unique ID for the input based on its properties
    const tagName = input.tagName.toLowerCase();
    const placeholder = input.placeholder || '';
    const className = input.className || '';
    const position = Array.from(document.querySelectorAll(tagName)).indexOf(input);
    return `promptok-input-${tagName}-${position}-${Date.now()}`;
  }

  cleanupOrphanedButtons() {
    // Remove buttons that no longer have corresponding inputs
    const buttons = document.querySelectorAll(`.${this.buttonClass}`);
    buttons.forEach(button => {
      const inputId = button.getAttribute('data-input-id');
      if (inputId) {
        const correspondingInput = document.querySelector(`[data-promptok-id="${inputId}"]`);
        if (!correspondingInput || !this.isValidInput(correspondingInput)) {
          button.remove();
          this.debugLog('Removed orphaned button for input:', inputId);
        }
      } else {
        // Remove buttons without proper input association
        button.remove();
        this.debugLog('Removed button without input association');
      }
    });
  }

  addEnhanceButton(input) {
    const button = this.createEnhanceButton(input);
    this.positionButton(input, button);
    this.attachButtonEvents(button, input);
    
    // Mark input as having button
    input.classList.add('promptok-input-with-button');
  }

  createEnhanceButton(input) {
    const button = document.createElement('button');
    // Include the generic class so stylesheet rules apply
    button.className = `${this.buttonClass} promptok-enhance-button`;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L15.09 8.26L22 9L17 14.74L18.18 22L12 18.27L5.82 22L7 14.74L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
        <path d="M12 7L14.09 12.26L19 13L15 16.74L16.18 21L12 17.77L7.82 21L9 16.74L5 13L9.91 12.26L12 7Z" fill="currentColor" opacity="0.6"/>
      </svg>
    `;
    // Remove default browser tooltip; keep aria-label for accessibility
    try { button.removeAttribute('title'); } catch (_) { /* ignore */ }
    button.setAttribute('aria-label', 'Enhance prompt with AI');
    // Link button to specific input
    const inputId = input.getAttribute('data-promptok-id');
    button.setAttribute('data-input-id', inputId);
    // Modern inline styles with glassmorphism - reverted to original 32px size
    const s = (prop, val) => button.style.setProperty(prop, val, 'important');
    s('position', 'absolute');
    s('width', '32px');
    s('height', '32px');
    s('z-index', '2147483647');
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
    // Position will be set by updateFloatingButtonPosition()
    return button;
  }

  // Toggle loading state on the floating button with tooltip support
  setButtonLoading(button, isLoading, message = 'Enhancing…') {
    try {
      if (!button) return;
      if (isLoading) {
        button.classList.add('loading');
        button.setAttribute('aria-busy', 'true');
        button.dataset.loading = 'true';
        button.style.setProperty('pointer-events', 'auto', 'important'); // keep hover events
        // Store tooltip text; show only on hover
        button._promptokTooltipText = message;
        this.updateButtonTooltip(button, '', /*show*/ false);
      } else {
        button.classList.remove('loading');
        button.removeAttribute('aria-busy');
        delete button.dataset.loading;
        button._promptokTooltipText = '';
        this.updateButtonTooltip(button, '', /*show*/ false);
      }
    } catch (_) { /* ignore */ }
  }

  // Ensure a tooltip element exists for the button and update its text/visibility
  updateButtonTooltip(button, text, show) {
    try {
      let tip = button._promptokTooltip;
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'promptok-tooltip';
        tip.textContent = '';
        button.appendChild(tip);
        button._promptokTooltip = tip;
      }
      if (typeof text === 'string') tip.textContent = text;
      if (show) {
        tip.classList.add('show');
      } else {
        tip.classList.remove('show');
      }
    } catch (_) { /* ignore */ }
  }

  applyButtonStyles(button) {
    // No-op: styles are applied inline with !important in createEnhanceButton()
  }

  positionButton(input, button) {
    // Anchor inside a stable container
    // GPT-only: use closest NON-scrollable ancestor so inner scrolling doesn't move the icon
    const host = (window.location && window.location.hostname) || '';
    const isGPT = host.includes('openai.com') || host.includes('chatgpt.com') || host.includes('chat.openai.com');
    const isClaude = host.includes('claude.ai');
    const isGemini = host.includes('gemini.google.com') || host.includes('bard.google.com');
    const useStableAncestor = isGPT || isClaude;
    // For Gemini, try to skip known toolbar wrappers and anchor higher up
    const parent = isGemini
      ? (this.findGeminiAnchor(input) || this.findClosestNonScrollableAncestor(input) || document.body)
      : (useStableAncestor
          ? (this.findClosestNonScrollableAncestor(input) || document.body)
          : (input.parentElement || document.body));
    // Ensure parent can host absolute children
    try {
      const cs = window.getComputedStyle(parent);
      if (cs && cs.position === 'static') {
        // Avoid changing body positioning
        if (parent !== document.body) {
          parent.style.setProperty('position', 'relative', 'important');
        }
      }
    } catch (_) { /* ignore */ }
    if (button.parentElement !== parent) {
      parent.appendChild(button);
    }
    this.updateFloatingButtonPosition(input, button);
    this.floatingButtons.set(input, button);
    // Observe ONLY size changes of this input to keep anchor stable on growth
    try {
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => this.updateFloatingButtonPosition(input, button));
        ro.observe(input);
        button._promptokResizeObserver = ro;
      }
    } catch (_) {
      // best-effort
    }
    // Hide/show based on viewport visibility of the input (disabled for GPT to avoid disappearing on inner scroll)
    try {
      const host = (window.location && window.location.hostname) || '';
      const isGPT = host.includes('openai.com') || host.includes('chatgpt.com') || host.includes('chat.openai.com');
      const isClaude = host.includes('claude.ai');
      if (!(isGPT || isClaude) && window.IntersectionObserver) {
        const io = new IntersectionObserver((entries) => {
          const entry = entries && entries[0];
          const visible = !!(entry && entry.isIntersecting);
          button.style.setProperty('display', visible ? 'flex' : 'none', 'important');
        }, { root: null, threshold: 0.2 });
        io.observe(input);
        button._promptokIntersectionObserver = io;
      } else {
        // Ensure visible on GPT/Claude
        button.style.setProperty('display', 'flex', 'important');
      }
    } catch (_) { /* ignore */ }
  }

  // Find the closest ancestor that does NOT have scrollable overflow so the icon stays put when inner content scrolls
  findClosestNonScrollableAncestor(el) {
    try {
      let node = el && el.parentElement;
      while (node && node !== document.body) {
        const cs = window.getComputedStyle(node);
        const overflowY = cs.overflowY;
        const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
        if (!isScrollable) return node;
        node = node.parentElement;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }

  // Gemini-specific: find an ancestor above the leading actions/toolbox/uploader wrappers
  // to avoid being occluded by their stacking contexts.
  findGeminiAnchor(el) {
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
            // Anchor to the first parent above toolbarish wrapper, preferring non-scrollable
            return lastNonScrollable || node.parentElement || document.body;
          }
        } catch (_) { /* ignore */ }
        node = node.parentElement;
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  updateFloatingButtonPosition(input, button) {
    try {
      // Modern offsets with better spacing - adjusted for 32px button
      const host = (window.location && window.location.hostname) || '';
      const isGPT = host.includes('openai.com') || host.includes('chatgpt.com') || host.includes('chat.openai.com');
      const isClaude = host.includes('claude.ai');
      const isPerplexity = host.includes('perplexity.ai');
      const isGemini = host.includes('gemini.google.com') || host.includes('bard.google.com');
      // Modern site-specific offsets for better integration
      const rightOffset = isGPT ? 100 : (isClaude ? 180 : (isPerplexity ? 60 : (isGemini ? 80 : 60)));
      const bottomOffset = isGPT ? 12 : (isClaude ? 12 : (isPerplexity ? 12 : (isGemini ? 12 : 12)));

      const s = (prop, val) => button.style.setProperty(prop, val, 'important');
      s('right', `${rightOffset}px`);
      s('bottom', `${bottomOffset}px`);
      s('left', 'auto');
      s('top', 'auto');
      s('transform', 'none');

      // Add hover effects for the floating button
      button.addEventListener('mouseenter', () => {
        if (!button.classList.contains('loading')) {
          s('transform', 'scale(1.1)');
          s('box-shadow', '0 12px 32px rgba(0, 0, 0, 0.6), 0 6px 16px rgba(0, 112, 243, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)');
          s('border-color', 'rgba(0, 112, 243, 0.8)');
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!button.classList.contains('loading')) {
          s('transform', 'scale(1)');
          s('box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 112, 243, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)');
          s('border-color', 'rgba(255, 255, 255, 0.15)');
        }
      });

      // If a minimized icon is present, keep it positioned next to the enhance button
      try {
        const minimized = document.querySelector(`.${this.minimizedButtonClass}`);
        if (minimized) {
          this.positionMinimizedButton(input, minimized, { siblingButton: button });
        }
      } catch (_) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }

  repositionAllButtons() {
    try {
      // Clean out any removed/invalid inputs and reposition the rest
      const toDelete = [];
      for (const [input, button] of this.floatingButtons.entries()) {
        if (!input || !document.contains(input) || !this.isValidInput(input)) {
          if (button) {
            if (button._promptokResizeObserver) {
              try { button._promptokResizeObserver.disconnect(); } catch (_) {}
              delete button._promptokResizeObserver;
            }
            if (button._promptokIntersectionObserver) {
              try { button._promptokIntersectionObserver.disconnect(); } catch (_) {}
              delete button._promptokIntersectionObserver;
            }
            if (button.parentNode) button.parentNode.removeChild(button);
          }
          toDelete.push(input);
          continue;
        }
        this.updateFloatingButtonPosition(input, button);
      }
      toDelete.forEach((inp) => this.floatingButtons.delete(inp));
    } catch (_) {
      // best-effort
    }
  }

  attachGlobalPositionListeners() {
    // Remove any previously installed global listeners/observers to disable scrolling behavior completely
    try {
      if (this._repositionBound) {
        window.removeEventListener('scroll', this._repositionBound, true);
        window.removeEventListener('resize', this._repositionBound, true);
      }
      this._repositionBound = null;
      if (this._mutationObserver) {
        try { this._mutationObserver.disconnect(); } catch (_) {}
        this._mutationObserver = null;
      }
    } catch (_) {
      // ignore
    }
  }

  addInputPadding(input) {
    // Not needed for floating button; keep as no-op to avoid changing site layouts
  }

  attachButtonEvents(button, input) {
    // Store reference to input for this button
    button._promptokInput = input;
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Prevent duplicate requests if loading
      if (button.classList.contains('loading')) {
        return;
      }
      // Set the current input context
      this.currentInput = input;
      // Start loading UX on the icon
      this.setButtonLoading(button, true, 'Enhancing…');
      // Set a long-wait tooltip updater after 5s from click
      try {
        if (button._promptokLongWaitTimer) clearTimeout(button._promptokLongWaitTimer);
      } catch(_){}
      button._promptokLongWaitTimer = setTimeout(() => {
        // Update stored hover text for long wait
        const longText = 'Taking longer than expected….';
        button._promptokTooltipText = longText;
        // If tooltip is currently visible, update it
        if (button._promptokTooltip && button._promptokTooltip.classList.contains('show')) {
          this.updateButtonTooltip(button, longText, true);
        }
      }, 5000);
      this.startEnhancement(button);
    }, true);
    
    // Ensure button stays clickable
    button.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    }, true);

    // Show tooltip on hover
    button.addEventListener('mouseenter', () => {
      if (button.classList.contains('loading')) {
        // Show the current stored tooltip text (default or long-wait)
        const txt = typeof button._promptokTooltipText === 'string' && button._promptokTooltipText.length
          ? button._promptokTooltipText
          : 'Enhancing…';
        this.updateButtonTooltip(button, txt, true);
      } else {
        // Not loading: show brand tooltip
        this.updateButtonTooltip(button, 'PromptOK', true);
      }
    });
    button.addEventListener('mouseleave', () => {
      this.updateButtonTooltip(button, '', false);
    });
  }

  async startEnhancement(button) {
    // If minimized, clear minimized state and icon before starting a fresh enhancement
    if (this.isMinimized) {
      try { this.removeMinimizedButton(); } catch (_) { /* ignore */ }
      this.isMinimized = false;
    }
    // Re-check authentication status on each button click
    const isAuthenticated = await this.checkAuthenticationStatus();
    if (!isAuthenticated) {
      this.showAuthRequired();
      // Clear loading state if present
      if (button) {
        try { if (button._promptokLongWaitTimer) clearTimeout(button._promptokLongWaitTimer); } catch(_){}
        this.setButtonLoading(button, false);
      }
      return;
    }

    // Use the stored current input or detect a new one
    const input = this.currentInput || await this.detect();
    if (!input) return;
    
    const prompt = input.value || input.textContent || '';
    if (!prompt.trim()) {
      this.showError('Please enter a prompt first');
      if (button) {
        try { if (button._promptokLongWaitTimer) clearTimeout(button._promptokLongWaitTimer); } catch(_){}
        this.setButtonLoading(button, false);
      }
      return;
    }

    // Use button animation instead of full-screen overlay during loading
    try {
      // Get enhanced prompt data from API
      const enhancementData = await this.getEnhancementData(prompt);
      this.currentEnhancementData = enhancementData;
      // Persist session right after data arrives
      this.saveSessionState().catch(() => {});
      
      // Check if we have structured data from the Edge Function
      if (enhancementData.structuredData) {
        console.log('Using structured data from Edge Function');
        this.showEnhancementOptions(enhancementData.structuredData);
      } else {
        // Try to parse JSON from raw response
        const parsedData = this.parseEnhancementResponse(enhancementData.rawResponse);
        
        if (parsedData) {
          this.showEnhancementOptions(parsedData);
        } else {
          // Fallback to simple enhancement
          console.log('Using fallback: applying simple enhancement');
          this.applySimpleEnhancement(enhancementData.rawResponse);
        }
      }
    } catch (error) {
      // Handle specific error types with better logging
      if (error.message === 'AUTH_ERROR') {
        console.log('[PromptOK] User authentication required - showing login prompt');
        this.showAuthError();
      } else if (error.message === 'RATE_LIMIT_ERROR') {
        console.log('[PromptOK] Usage limit reached - showing upgrade prompt');
        this.showRateLimitError();
      } else {
        console.error('[PromptOK] Enhancement failed:', error.message || error);
        this.showError('Failed to enhance prompt. Please try again.');
      }
    } finally {
      // Always clear loading UX
      if (button) {
        try { if (button._promptokLongWaitTimer) clearTimeout(button._promptokLongWaitTimer); } catch(_){}
        this.setButtonLoading(button, false);
      }
    }
  }

  async getEnhancementData(prompt) {
    const jwtData = await this.getExtensionJWT();
    if (!jwtData.jwt) {
      throw new Error('AUTH_ERROR');
    }

    const response = await this.makeApiRequest(prompt, jwtData.jwt);
    const data = await this.handleApiResponse(response);
    return {
      rawResponse: data.enhancedPrompt,
      structuredData: data.structuredData
    };
  }

  async getExtensionJWT() {
    try {
      // Request JWT from background script
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EXTENSION_JWT'
      });

      if (response.error) {
        console.error('[PromptOK Content] JWT error:', response.error);
        return { jwt: null, expiresAt: null };
      }

      if (!response.jwt) {
        console.log('[PromptOK Content] No JWT available');
        return { jwt: null, expiresAt: null };
      }

      return response;
    } catch (error) {
      // Handle the specific MV3 error where the extension context becomes invalid
      const msg = (error && (error.message || String(error))) || '';
      if (typeof msg === 'string' && msg.toLowerCase().includes('extension context invalidated')) {
        console.warn('[PromptOK Content] Extension context invalidated. Please refresh the page and open the PromptOK popup once to reinitialize.');
        // Provide a clear user-facing cue without retrying
        this.showAuthRequired();
        return { jwt: null, expiresAt: null };
      }
      console.error('[PromptOK Content] Error getting JWT:', error);
      return { jwt: null, expiresAt: null };
    }
  }

  async makeApiRequest(prompt, jwt) {
    // Use environment-based API endpoint
    const apiEndpoint = await this.getApiEndpoint();
    
    console.log('[PromptOK Content] Making API request:', {
      endpoint: apiEndpoint,
      hasJWT: !!jwt,
      jwtLength: jwt ? jwt.length : 0,
      promptLength: prompt.length
    });
    
    return fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ prompt })
    });
  }

  async getApiEndpoint() {
    // Use environment-based configuration
    if (!window.promptokEnvConfig) {
      throw new Error('Environment configuration not loaded');
    }
    const baseUrl = await window.promptokEnvConfig.getApiBase();
    return `${baseUrl}/api/extension/enhance`;
  }

  async handleApiResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: Enhancement failed`;
      
      // Enhanced logging for debugging
      console.error('[PromptOK Content] API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        errorMessage,
        url: response.url
      });
      
      // Handle JWT-specific error responses
      if (response.status === 401) {
        // Token expired or invalid, try to refresh
        console.log('[PromptOK Content] JWT expired, attempting refresh');
        await this.refreshJWT();
        throw new Error('AUTH_ERROR');
      }
      
      if (response.status === 403) {
        // Insufficient permissions or rate limit
        if (errorMessage.toLowerCase().includes('insufficient permissions')) {
          throw new Error('AUTH_ERROR');
        } else {
          throw new Error('RATE_LIMIT_ERROR');
        }
      }
      
      // Handle other error types
      if (errorMessage.toLowerCase().includes('usage limit') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('upgrade')) {
        throw new Error('RATE_LIMIT_ERROR');
      }
      
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async refreshJWT() {
    try {
      await chrome.runtime.sendMessage({
        type: 'REFRESH_EXTENSION_JWT'
      });
      console.log('[PromptOK Content] JWT refresh requested');
    } catch (error) {
      console.error('[PromptOK Content] Error refreshing JWT:', error);
    }
  }

  parseEnhancementResponse(responseText) {
    try {
      console.log('Raw API response:', responseText);
      
      const jsonData = this.extractJsonFromResponse(responseText);
      if (!jsonData) {
        console.log('No JSON found, falling back to simple enhancement');
        return null;
      }
      
      const parsed = JSON.parse(jsonData);
      return this.validateParsedData(parsed) ? parsed : null;
    } catch (error) {
      console.error('Failed to parse enhancement response:', error);
      console.log('Response text that failed to parse:', responseText);
      return null;
    }
  }

  extractJsonFromResponse(responseText) {
    // Try to find complete JSON block first
    let jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
    
    if (!jsonMatch) {
      // If no complete block, try to find truncated JSON
      jsonMatch = responseText.match(/```json\s*([\s\S]*?)$/i);
      
      if (jsonMatch) {
        console.warn('Found truncated JSON block, attempting to parse');
        let jsonText = jsonMatch[1].trim();
        
        // Try to fix common truncation issues
        if (!jsonText.endsWith('}')) {
          // Find the last complete object/array and close it
          const lastCompleteObject = this.findLastCompleteJson(jsonText);
          if (lastCompleteObject) {
            jsonText = lastCompleteObject;
          }
        }
        
        return jsonText;
      }
      
      console.warn('No JSON block found in response');
      return null;
    }
    
    return jsonMatch[1].trim();
  }

  findLastCompleteJson(jsonText) {
    try {
      // Try parsing as-is first
      JSON.parse(jsonText);
      return jsonText;
    } catch (e) {
      // Try to find the last complete structure
      let braceCount = 0;
      let lastValidIndex = -1;
      
      for (let i = 0; i < jsonText.length; i++) {
        if (jsonText[i] === '{') {
          braceCount++;
        } else if (jsonText[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastValidIndex = i;
          }
        }
      }
      
      if (lastValidIndex > 0) {
        const truncated = jsonText.substring(0, lastValidIndex + 1);
        try {
          JSON.parse(truncated);
          return truncated;
        } catch (e) {
          console.warn('Could not repair truncated JSON');
        }
      }
    }
    
    return null;
  }

  validateParsedData(parsed) {
    const requiredFields = ['enhanced_prompt', 'assumption_groups'];
    const isValid = requiredFields.every(field => parsed[field]);
    
    if (!isValid) {
      console.warn('Invalid JSON structure - missing required fields:', requiredFields);
    }
    
    return isValid;
  }

  isChatGPT() {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  showLoadingOverlayChatGPT() {
    this.removeExistingOverlay();

    // Create a right-side panel instead of full-screen overlay
    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>✨ Enhancing...</h4>
        <button class="promptok-chatgpt-close" aria-label="Close">×</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="loading-spinner"></div>
        <p>AI is analyzing and improving your prompt</p>
      </div>
    `;

    this.addChatGPTStyles(panel);
    document.body.appendChild(panel);

    // Add close listener
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    closeBtn.addEventListener('click', () => this.closeOverlay());

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  showEnhancementOptionsChatGPT(parsedData) {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    panel.setAttribute('data-enhancement-data', JSON.stringify(parsedData));

    // Build the options UI
    const optionsHTML = this.buildOptionsHTML(parsedData);

    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>✨ Enhanced Prompt Ready</h4>
        <div class="header-controls">
          <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
          <button class="promptok-chatgpt-close" aria-label="Close">×</button>
        </div>
      </div>

      <div class="promptok-chatgpt-content">
        <div class="enhanced-prompt-preview">
          <h5>Base Enhanced Prompt:</h5>
          <div class="prompt-text">${this.escapeHtml(parsedData.enhanced_prompt)}</div>
        </div>

        <div class="options-section">
          <h5>Customize Your Prompt:</h5>
          <p class="options-description">Select options to further customize your enhanced prompt</p>
          ${optionsHTML}
        </div>

        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-apply" class="primary">Apply</button>
          <button id="promptok-chatgpt-copy" class="copy-icon" title="Copy to clipboard">📋</button>
        </div>

        <div class="promptok-chatgpt-status"></div>
      </div>
    `;

    this.addChatGPTStyles(panel);
    document.body.appendChild(panel);

    // Add event listeners
    this.setupChatGPTEventListeners(panel, parsedData);
  }

  addChatGPTStyles(panel) {
    const style = document.createElement('style');
    style.textContent = `
      .promptok-chatgpt-panel {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 420px !important;
        height: 100vh !important;
        background: linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%) !important;
        border-left: 1px solid rgba(0, 112, 243, 0.3) !important;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.8) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        flex-direction: column !important;
        backdrop-filter: blur(25px) !important;
        -webkit-backdrop-filter: blur(25px) !important;
        animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        overflow: hidden !important;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .promptok-chatgpt-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 16px 20px !important;
        background: rgba(0, 112, 243, 0.05) !important;
        border-bottom: 1px solid rgba(0, 112, 243, 0.15) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        flex-shrink: 0 !important;
      }

      .promptok-chatgpt-header h4 {
        margin: 0 !important;
        color: white !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        background: linear-gradient(135deg, #00f0ff 0%, #ffffff 50%, #667eea 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        text-shadow: 0 0 15px rgba(0, 112, 243, 0.3) !important;
      }

      .header-controls {
        display: flex !important;
        gap: 8px !important;
        align-items: center !important;
      }

      .promptok-chatgpt-minimize,
      .promptok-chatgpt-close {
        color: rgba(255, 255, 255, 0.8) !important;
        background: rgba(0, 112, 243, 0.1) !important;
        border: 1px solid rgba(0, 112, 243, 0.2) !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
      }

      .promptok-chatgpt-minimize:hover,
      .promptok-chatgpt-close:hover {
        background: rgba(0, 112, 243, 0.2) !important;
        color: white !important;
        transform: translateY(-1px) scale(1.05) !important;
        box-shadow: 0 4px 16px rgba(0, 112, 243, 0.3) !important;
      }

      .promptok-chatgpt-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 0 20px 20px !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(0, 112, 243, 0.4) transparent !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar {
        width: 6px !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-track {
        background: transparent !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-thumb {
        background: rgba(0, 112, 243, 0.4) !important;
        border-radius: 3px !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 112, 243, 0.6) !important;
      }

      .loading-spinner {
        width: 32px !important;
        height: 32px !important;
        border: 2px solid rgba(0, 112, 243, 0.1) !important;
        border-top: 2px solid #00f0ff !important;
        border-right: 2px solid #667eea !important;
        border-radius: 50% !important;
        animation: spinNeon 1s linear infinite !important;
        margin: 20px auto !important;
        box-shadow: 0 0 15px rgba(0, 112, 243, 0.3) !important;
      }

      @keyframes spinNeon {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .enhanced-prompt-preview {
        margin-bottom: 20px !important;
      }

      .enhanced-prompt-preview h5 {
        margin: 0 0 12px 0 !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.3) !important;
      }

      .prompt-text {
        background: rgba(0, 0, 0, 0.3) !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(0, 112, 243, 0.2) !important;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #00f0ff !important;
        max-height: 100px !important;
        overflow-y: auto !important;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        text-shadow: 0 0 6px rgba(0, 112, 243, 0.4) !important;
      }

      .options-section h5 {
        margin: 0 0 8px 0 !important;
        color: white !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        text-shadow: 0 0 10px rgba(0, 112, 243, 0.4) !important;
        letter-spacing: -0.025em !important;
      }

      .options-description {
        margin: 0 0 16px 0 !important;
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        text-shadow: 0 0 6px rgba(0, 112, 243, 0.2) !important;
      }

      .option-group {
        margin-bottom: 16px !important;
        padding: 14px !important;
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(0, 112, 243, 0.1) !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
      }

      .option-group h6 {
        margin: 0 0 8px 0 !important;
        color: white !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        text-shadow: 0 0 6px rgba(0, 112, 243, 0.3) !important;
      }

      .group-description {
        margin: 0 0 12px 0 !important;
        color: rgba(255, 255, 255, 0.6) !important;
        font-size: 12px !important;
        line-height: 1.3 !important;
      }

      .options {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }

      .option-item {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 12px 16px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border-radius: 20px !important;
        border: 1px solid rgba(0, 112, 243, 0.2) !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2) !important;
        position: relative !important;
        overflow: hidden !important;
      }

      .option-item::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: -100% !important;
        width: 100% !important;
        height: 100% !important;
        background: linear-gradient(90deg, transparent, rgba(0, 112, 243, 0.1), transparent) !important;
        transition: left 0.5s ease !important;
      }

      .option-item:hover::before {
        left: 100% !important;
      }

      .option-item:hover {
        border-color: rgba(0, 112, 243, 0.4) !important;
        background: rgba(0, 112, 243, 0.1) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 16px rgba(0, 112, 243, 0.2) !important;
      }

      .option-item input[type="checkbox"],
      .option-item input[type="radio"] {
        margin: 0 !important;
        cursor: pointer !important;
        width: 16px !important;
        height: 16px !important;
        accent-color: #00f0ff !important;
        flex-shrink: 0 !important;
      }

      .option-content {
        flex: 1 !important;
        min-width: 0 !important;
      }

      .option-label {
        display: block !important;
        font-weight: 600 !important;
        color: white !important;
        margin-bottom: 2px !important;
        font-size: 12px !important;
        letter-spacing: -0.025em !important;
        line-height: 1.2 !important;
        text-shadow: 0 0 4px rgba(0, 112, 243, 0.2) !important;
      }

      .option-short {
        display: block !important;
        font-size: 11px !important;
        color: rgba(255, 255, 255, 0.6) !important;
        line-height: 1.2 !important;
        text-shadow: 0 0 3px rgba(0, 112, 243, 0.1) !important;
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-label,
      .option-item input[type="radio"]:checked ~ .option-content .option-label {
        color: #00f0ff !important;
        font-weight: 700 !important;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.5) !important;
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-short,
      .option-item input[type="radio"]:checked ~ .option-content .option-short {
        color: rgba(0, 112, 243, 0.8) !important;
        text-shadow: 0 0 4px rgba(0, 112, 243, 0.3) !important;
      }

      .promptok-chatgpt-actions {
        display: flex !important;
        gap: 10px !important;
        margin-top: 20px !important;
        align-items: center !important;
        padding-top: 16px !important;
        border-top: 1px solid rgba(0, 112, 243, 0.1) !important;
      }

      .promptok-chatgpt-actions button {
        flex: 1 !important;
        padding: 10px 16px !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        font-size: 13px !important;
        letter-spacing: -0.025em !important;
      }

      .promptok-chatgpt-actions button.primary {
        background: linear-gradient(135deg, #00f0ff 0%, #667eea 100%) !important;
        color: #000 !important;
        border: 1px solid rgba(0, 112, 243, 0.3) !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 16px rgba(0, 112, 243, 0.3) !important;
      }

      .promptok-chatgpt-actions button.primary:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 20px rgba(0, 112, 243, 0.4) !important;
      }

      .promptok-chatgpt-actions button.copy-icon {
        width: 36px !important;
        height: 36px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(0, 112, 243, 0.2) !important;
        border-radius: 8px !important;
        color: #00f0ff !important;
        font-size: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        backdrop-filter: blur(10px) !important;
      }

      .promptok-chatgpt-actions button.copy-icon:hover {
        background: rgba(0, 112, 243, 0.1) !important;
        color: #00f0ff !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 16px rgba(0, 112, 243, 0.3) !important;
        border-color: rgba(0, 112, 243, 0.4) !important;
      }

      .promptok-chatgpt-status {
        margin-top: 12px !important;
        padding: 8px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        text-align: center !important;
        backdrop-filter: blur(10px) !important;
      }

      .promptok-chatgpt-status.success {
        background: rgba(34, 197, 94, 0.1) !important;
        color: #22f055 !important;
        border: 1px solid rgba(34, 197, 94, 0.2) !important;
      }
    `;
    panel.appendChild(style);
  }

  setupChatGPTEventListeners(panel, parsedData) {
    // Close button
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    closeBtn.addEventListener('click', () => this.closeOverlay());

    // Minimize button
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    minimizeBtn.addEventListener('click', () => this.minimizeChatGPTOverlay(panel));

    // Apply prompt (base + selected options)
    const applyBtn = panel.querySelector('#promptok-chatgpt-apply');
    applyBtn.addEventListener('click', () => {
      this.debugLog('Apply button clicked');
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.debugLog('Final prompt built:', finalPrompt);
      this.applyPromptToInput(finalPrompt);
    });

    // Copy to clipboard
    const copyBtn = panel.querySelector('#promptok-chatgpt-copy');
    copyBtn.addEventListener('click', () => {
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.copyToClipboard(finalPrompt);
    });

    // Option selection handling (both checkboxes and radios)
    const inputs = panel.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    inputs.forEach(input => {
      // Restore previous selections
      if (this.selectedOptions.has(input.value)) {
        input.checked = true;
      }

      input.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
          // For radio buttons, remove other options from same group
          const groupId = e.target.dataset.group;
          const groupInputs = panel.querySelectorAll(`input[data-group="${groupId}"]`);
          groupInputs.forEach(groupInput => {
            this.selectedOptions.delete(groupInput.value);
          });
          this.selectedOptions.add(e.target.value);
        } else {
          if (e.target.checked) {
            this.selectedOptions.add(e.target.value);
          } else {
            this.selectedOptions.delete(e.target.value);
          }
        }
        this.updateChatGPTButtonText(panel);
        this.updateMinimizedButtonCount();
        // Persist session on selection changes
        this.saveSessionState().catch(() => {});
      });
    });

    // Update button text based on current selections
    this.updateChatGPTButtonText(panel);

    // Close on Escape key
    const escHandler = (e) => {
      try {
        if (e.key === 'Escape') {
          this.closeOverlay();
        }
      } catch (_) { /* ignore */ }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  updateChatGPTButtonText(panel) {
    const applyBtn = panel.querySelector('#promptok-chatgpt-apply');
    const count = this.selectedOptions.size;

    if (count > 0) {
      applyBtn.textContent = `Apply + ${count} Option${count > 1 ? 's' : ''}`;
    } else {
      applyBtn.textContent = 'Apply';
    }
  }

  minimizeChatGPTOverlay(panel) {
    this.debugLog('Minimizing ChatGPT overlay, preserving data');
    this.debugLog('Enhancement data before minimize:', !!this.currentEnhancementData);

    this.isMinimized = true;
    panel.style.opacity = '0';

    setTimeout(() => {
      panel.remove();
      this.showMinimizedButton();
      // Persist session after minimizing
      this.saveSessionState().catch(() => {});
      this.debugLog('ChatGPT overlay minimized, data preserved:', !!this.currentEnhancementData);
    }, 400);
  }

  showSuccessChatGPT(message) {
    const panel = document.querySelector('.promptok-chatgpt-panel');
    if (!panel) return;

    const statusEl = panel.querySelector('.promptok-chatgpt-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'promptok-chatgpt-status success';
    }
  }

  showErrorChatGPT(message) {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>⚠️ Enhancement Error</h4>
        <button class="promptok-chatgpt-close" aria-label="Close">×</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <p>${message}</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-close-error" class="primary">Close</button>
        </div>
      </div>
    `;

    this.addChatGPTStyles(panel);
    document.body.appendChild(panel);

    // Add close listeners
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    const closeErrorBtn = panel.querySelector('#promptok-chatgpt-close-error');

    const closeHandler = () => this.closeOverlay();
    closeBtn.addEventListener('click', closeHandler);
    closeErrorBtn.addEventListener('click', closeHandler);

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  showAuthErrorChatGPT() {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>🔒 Login Required</h4>
        <button class="promptok-chatgpt-close" aria-label="Close">×</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <h3>Please log in to use the enhancement feature</h3>
          <p>You need to be signed in to access AI-powered prompt enhancement.</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-login" class="primary">Log In</button>
          <button id="promptok-chatgpt-close-auth" class="secondary">Close</button>
        </div>
      </div>
    `;

    this.addChatGPTStyles(panel);
    document.body.appendChild(panel);

    // Add event listeners
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    const loginBtn = panel.querySelector('#promptok-chatgpt-login');
    const closeAuthBtn = panel.querySelector('#promptok-chatgpt-close-auth');

    const closeHandler = () => this.closeOverlay();
    closeBtn.addEventListener('click', closeHandler);
    closeAuthBtn.addEventListener('click', closeHandler);

    loginBtn.addEventListener('click', () => {
      // Redirect to login page
      window.open('https://promptok.app/auth/start', '_blank');
      closeHandler();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  showRateLimitErrorChatGPT() {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>⚡ Enhancement Limit Reached</h4>
        <button class="promptok-chatgpt-close" aria-label="Close">×</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <h3>Enhancement limit reached</h3>
          <p>You've reached your current plan's enhancement limit. Upgrade to continue using AI-powered enhancements.</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-upgrade" class="primary">Upgrade Subscription</button>
          <button id="promptok-chatgpt-close-limit" class="secondary">Close</button>
        </div>
      </div>
    `;

    this.addChatGPTStyles(panel);
    document.body.appendChild(panel);

    // Add event listeners
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    const upgradeBtn = panel.querySelector('#promptok-chatgpt-upgrade');
    const closeLimitBtn = panel.querySelector('#promptok-chatgpt-close-limit');

    const closeHandler = () => this.closeOverlay();
    closeBtn.addEventListener('click', closeHandler);
    closeLimitBtn.addEventListener('click', closeHandler);

    upgradeBtn.addEventListener('click', () => {
      // Redirect to purchase page
      window.open('https://promptok.app/dashboard', '_blank');
      closeHandler();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  closeChatGPTOverlay() {
    this.debugLog('Closing ChatGPT overlay completely');
    const existing = document.querySelector('.promptok-chatgpt-panel');
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 400);
    }

    this.removeMinimizedButton();
    this.selectedOptions.clear();
    this.currentEnhancementData = null;
    this.isMinimized = false;
    // Clear any persisted session
    this.clearSessionState().catch(() => {});
  }

  removeExistingChatGPTOverlay() {
    // Pure DOM cleanup: remove any existing ChatGPT overlay without touching state
    try {
      const existing = document.querySelector('.promptok-chatgpt-panel');
      if (existing) existing.remove();
    } catch (_) { /* noop */ }
  }

  buildOptionsHTML(parsedData) {
    return (parsedData.assumption_groups || [])
      .map(group => this.buildGroupHTML(group))
      .join('');
  }

  buildGroupHTML(group) {
    const groupId = this.escapeHtml(group.group_id || '');
    const title = this.escapeHtml(group.title || '');
    const description = this.escapeHtml(group.description || '');
    const inputType = group.input_type || 'checkbox';
    const optionsHTML = (group.options || [])
      .map(option => this.buildOptionHTML(option, groupId, inputType))
      .join('');

    return `
      <div class="option-group" data-group-id="${groupId}">
        <h6>${title}</h6>
        <p class="group-description">${description}</p>
        <div class="options">${optionsHTML}</div>
      </div>
    `;
  }

  buildOptionHTML(option, groupId, inputType = 'checkbox') {
    const optionId = this.escapeHtml(option.option_id || '');
    const label = this.escapeHtml(option.label || '');
    const short = this.escapeHtml(option.short || '');
    const name = inputType === 'radio' ? `group-${groupId}` : 'option';

    return `
      <label class="option-item">
        <input type="${inputType}" name="${name}" value="${optionId}" data-group="${groupId}">
        <div class="option-content">
          <span class="option-label">${label}</span>
          <span class="option-short">${short}</span>
        </div>
      </label>
    `;
  }

  setupEnhancedEventListeners(overlay, parsedData) {
    // Close button
    const closeBtn = overlay.querySelector('.promptok-close');
    closeBtn.addEventListener('click', () => this.closeOverlay());

    // Minimize button
    const minimizeBtn = overlay.querySelector('.promptok-minimize');
    minimizeBtn.addEventListener('click', () => this.minimizeOverlay());

    // Apply prompt (base + selected options)
    const applyBtn = overlay.querySelector('#promptok-apply');
    applyBtn.addEventListener('click', () => {
      this.debugLog('Apply button clicked');
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.debugLog('Final prompt built:', finalPrompt);
      this.applyPromptToInput(finalPrompt);
    });

    // Copy to clipboard
    const copyBtn = overlay.querySelector('#promptok-copy');
    copyBtn.addEventListener('click', () => {
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.copyToClipboard(finalPrompt);
    });

    // Option selection handling (both checkboxes and radios)
    const inputs = overlay.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    inputs.forEach(input => {
      // Restore previous selections
      if (this.selectedOptions.has(input.value)) {
        input.checked = true;
      }

      input.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
          // For radio buttons, remove other options from same group
          const groupId = e.target.dataset.group;
          const groupInputs = overlay.querySelectorAll(`input[data-group="${groupId}"]`);
          groupInputs.forEach(groupInput => {
            this.selectedOptions.delete(groupInput.value);
          });
          this.selectedOptions.add(e.target.value);
        } else {
          if (e.target.checked) {
            this.selectedOptions.add(e.target.value);
          } else {
            this.selectedOptions.delete(e.target.value);
          }
        }
        this.updateButtonText(overlay);
        this.updateMinimizedButtonCount();
        // Persist session on selection changes
        this.saveSessionState().catch(() => {});
      });
    });

    // Update button text based on current selections
    this.updateButtonText(overlay);

    // Set default larger size
    const card = overlay.querySelector('.promptok-card.enhanced');
    card.style.width = '1000px';
    card.style.height = '600px';

    // Minimize when clicking outside (backdrop)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.minimizeOverlay();
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      try {
        if (e.key === 'Escape') {
          this.closeOverlay();
        }
      } catch (_) { /* ignore */ }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  updateMinimizedButtonCount() {
    const minimizedBtn = document.querySelector(`.${this.minimizedButtonClass}`);
    if (minimizedBtn) {
      const countEl = minimizedBtn.querySelector('.minimized-count');
      if (countEl) {
        countEl.textContent = this.selectedOptions.size;
        countEl.style.display = this.selectedOptions.size > 0 ? 'block' : 'none';
      }
    }
  }

  updateButtonText(overlay) {
    const applyBtn = overlay.querySelector('#promptok-apply');
    const count = this.selectedOptions.size;

    if (count > 0) {
      applyBtn.textContent = `Apply + ${count} Option${count > 1 ? 's' : ''}`;
    } else {
      applyBtn.textContent = 'Apply';
    }
  }

  applyPromptToInput(finalPrompt) {
    this.debugLog('Starting applyPromptToInput');
    const input = this.currentInput || this.detect();
    if (!input) {
      this.showError('Could not find input field to apply prompt');
      return;
    }
    
    this.debugLog('Input detected:', input.tagName, 'isLexical:', input.hasAttribute('data-lexical-editor'));
    this.debugLog('Input value before:', this.getInputValue(input));
    
    input.focus();
    
    try {
      const success = this.setInputValue(input, finalPrompt);
      
      // Verify and show result
      setTimeout(() => {
        this.verifyAndShowResult(input, finalPrompt, success);
      }, 200);
      
    } catch (error) {
      console.error('Error applying prompt:', error);
      this.showError('Failed to apply prompt. Please copy and paste manually.');
    }
  }

  setInputValue(input, text) {
    const isLexical = input.hasAttribute('data-lexical-editor');
    
    if (isLexical) {
      return this.setLexicalValue(input, text);
    } else if (input.value !== undefined) {
      return this.setValueProperty(input, text);
    } else if (input.isContentEditable) {
      return this.setContentEditableValue(input, text);
    }
    
    return false;
  }

  setLexicalValue(input, text) {
    try {
      // Clear existing content with Ctrl+A
      this.dispatchKeyEvent(input, 'keydown', 'a', { ctrlKey: true });
      
      // Use InputEvent API (proper method for Lexical)
      this.dispatchInputEvent(input, text, 'insertText');
      
      // Fallback: Selection-based replacement
      setTimeout(() => this.replaceViaSelection(input, text), 50);
      
      return true;
    } catch (e) {
      this.debugLog('Lexical value setting failed:', e);
      return false;
    }
  }

  setValueProperty(input, text) {
    try {
      // Use native setter to bypass framework interference
      const descriptor = input.tagName === 'TEXTAREA' 
        ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      
      if (descriptor?.set) {
        descriptor.set.call(input, text);
      } else {
        input.value = text;
      }
      
      this.dispatchInputEvent(input, text, 'insertText');
      return true;
    } catch (e) {
      this.debugLog('Value property setting failed:', e);
      return false;
    }
  }

  setContentEditableValue(input, text) {
    try {
      input.textContent = text;
      this.setCursorToEnd(input);
      this.dispatchInputEvent(input, text, 'insertText');
      return true;
    } catch (e) {
      this.debugLog('ContentEditable setting failed:', e);
      return false;
    }
  }

  // Helper methods for cleaner code
  getInputValue(input) {
    return input.value || input.textContent || input.innerText || '';
  }

  dispatchKeyEvent(input, type, key, modifiers = {}) {
    const event = new KeyboardEvent(type, {
      key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
      ...modifiers
    });
    input.dispatchEvent(event);
  }

  dispatchInputEvent(input, text, inputType = 'insertText') {
    try {
      // Dispatch beforeinput first
      input.dispatchEvent(new InputEvent('beforeinput', {
        data: text,
        inputType,
        bubbles: true,
        cancelable: true
      }));
      
      // Then dispatch input event
      input.dispatchEvent(new InputEvent('input', {
        data: text,
        inputType,
        bubbles: true,
        cancelable: true
      }));
      
    } catch (e) {
      this.debugLog(`InputEvent (${inputType}) failed:`, e);
    }
  }

  replaceViaSelection(input, text) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Try execCommand first
      if (document.execCommand('insertText', false, text)) {
        return true;
      }
      
      // Fallback to manual replacement
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      this.setCursorToEnd(input);
      
      return true;
    } catch (e) {
      this.debugLog('Selection replacement failed:', e);
      return false;
    }
  }

  setCursorToEnd(input) {
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      this.debugLog('Cursor positioning failed:', e);
    }
  }

  verifyAndShowResult(input, expectedText, wasSuccessful) {
    const currentValue = this.getInputValue(input);
    this.debugLog('Final value check:', currentValue.substring(0, 100) + '...');
    
    const isApplied = currentValue.includes(expectedText.substring(0, 50));
    
    if (!isApplied && wasSuccessful) {
      this.debugLog('Verification failed, trying fallback');
      this.tryAggressiveApply(input, expectedText);
      return;
    }
    
    const count = this.selectedOptions.size;
    const message = count > 0 
      ? `Enhanced prompt with ${count} option${count > 1 ? 's' : ''} applied!`
      : 'Enhanced prompt applied!';
    
    this.showSuccess(message);
    setTimeout(() => this.removeExistingOverlay(), 1500);
  }

  tryAggressiveApply(input, finalPrompt) {
    this.debugLog('Trying aggressive apply method');
    
    const isLexical = input.hasAttribute('data-lexical-editor');
    
    if (isLexical) {
      this.tryLexicalAggressiveApply(input, finalPrompt);
    } else {
      this.tryStandardAggressiveApply(input, finalPrompt);
    }
  }

  tryLexicalAggressiveApply(input, text) {
    try {
      this.debugLog('Trying Lexical aggressive apply');
      
      // Multiple InputEvent types for better compatibility
      const inputTypes = ['insertText', 'insertCompositionText', 'insertReplacementText'];
      
      inputTypes.forEach((inputType, index) => {
        setTimeout(() => {
          this.dispatchInputEvent(input, text, inputType);
        }, index * 100);
      });
      
      // Try composition events as final fallback
      setTimeout(() => {
        this.simulateCompositionInput(input, text);
      }, 400);
      
    } catch (e) {
      this.debugLog('Lexical aggressive apply failed:', e);
      this.simulateClipboardPaste(input, text);
    }
  }

  simulateCompositionInput(input, text) {
    try {
      const events = [
        new CompositionEvent('compositionstart', { data: '', bubbles: true }),
        new CompositionEvent('compositionupdate', { data: text, bubbles: true }),
        new CompositionEvent('compositionend', { data: text, bubbles: true })
      ];
      
      events.forEach((event, index) => {
        setTimeout(() => input.dispatchEvent(event), index * 10);
      });
      
      // Follow up with input event
      setTimeout(() => {
        this.dispatchInputEvent(input, text, 'insertCompositionText');
      }, 50);
      
    } catch (e) {
      this.debugLog('Composition simulation failed:', e);
    }
  }

  tryStandardAggressiveApply(input, text) {
    try {
      // Clear and set value directly
      if (input.value !== undefined) {
        input.value = text;
      } else {
        input.textContent = text;
      }
      
      // Dispatch essential events
      ['input', 'change'].forEach(eventType => {
        input.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
    } catch (e) {
      this.debugLog('Standard aggressive apply failed:', e);
      this.simulateClipboardPaste(input, text);
    }
  }

  simulateClipboardPaste(input, text) {
    try {
      input.focus();
      
      // Create clipboard event
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData
      });
      
      input.dispatchEvent(pasteEvent);
      
      // Fallback: Direct content setting
      setTimeout(() => {
        const currentValue = this.getInputValue(input);
        if (!currentValue.includes(text.substring(0, 20))) {
          if (input.value !== undefined) {
            input.value = text;
          } else {
            input.textContent = text;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 100);
      
    } catch (e) {
      this.debugLog('Clipboard simulation failed:', e);
    }
  }


  async copyToClipboard(finalPrompt) {
    try {
      await navigator.clipboard.writeText(finalPrompt);
      
      const count = this.selectedOptions.size;
      const message = count > 0 
        ? `Enhanced prompt with ${count} option${count > 1 ? 's' : ''} copied to clipboard!`
        : 'Enhanced prompt copied to clipboard!';
      
      this.showSuccess(message);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      this.showError('Failed to copy to clipboard. Please try again.');
    }
  }

  buildFinalPrompt(parsedData, selectedOptionIds) {
    const optionMap = this.createOptionMap(parsedData.assumption_groups || []);
    const appendParts = this.getSelectedSnippets(optionMap, selectedOptionIds);
    const comboSnippets = this.getCombinationSnippets(parsedData.combination_snippets || [], selectedOptionIds);
    
    const allSnippets = [...appendParts, ...comboSnippets].filter(Boolean);
    
    return allSnippets.length > 0 
      ? `${parsedData.enhanced_prompt}\n\n${allSnippets.join('\n')}`
      : parsedData.enhanced_prompt;
  }

  createOptionMap(assumptionGroups) {
    const optionMap = new Map();
    for (const group of assumptionGroups) {
      for (const option of group.options || []) {
        if (option.option_id && option.append_snippet) {
          optionMap.set(option.option_id, option.append_snippet);
        }
      }
    }
    return optionMap;
  }

  getSelectedSnippets(optionMap, selectedOptionIds) {
    return selectedOptionIds
      .map(id => optionMap.get(id))
      .filter(Boolean);
  }

  getCombinationSnippets(combinationSnippets, selectedOptionIds) {
    const selectedSet = new Set(selectedOptionIds);
    return combinationSnippets
      .filter(combo => {
        const comboSet = new Set(combo.combo || []);
        return this.isSubset(comboSet, selectedSet);
      })
      .map(combo => combo.append_snippet)
      .filter(Boolean);
  }

  isSubset(subset, superset) {
    return [...subset].every(item => superset.has(item));
  }

  applySimpleEnhancement(enhancedText) {
    const input = this.detect();
    if (!input) return;
    
    this.setInputValue(input, enhancedText);
    this.showSuccess('Prompt enhanced!');
    setTimeout(() => this.removeExistingOverlay(), 1500);
  }

  showSuccess(message) {
    // Check if we're on ChatGPT and use appropriate success method
    if (this.isChatGPT()) {
      this.showSuccessChatGPT(message);
    } else {
      // Original success implementation for other sites
      const overlay = document.querySelector('.promptok-overlay');
      if (!overlay) return;

      const statusEl = overlay.querySelector('.promptok-status');
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'promptok-status success';
      }
    }
  }

  // New: Unified error helper used across flows
  showError(message) {
    if (this.isChatGPT()) {
      return this.showErrorChatGPT(message);
    }
    // For non-ChatGPT pages, render error in the existing overlay if present
    const overlay = document.querySelector('.promptok-overlay');
    if (overlay) {
      let statusEl = overlay.querySelector('.promptok-status');
      if (!statusEl) {
        const card = overlay.querySelector('.promptok-card');
        statusEl = document.createElement('div');
        statusEl.className = 'promptok-status';
        if (card) card.appendChild(statusEl);
        else overlay.appendChild(statusEl);
      }
      statusEl.textContent = `⚠️ ${message}`;
      statusEl.className = 'promptok-status error';
      return;
    }
    // Minimal toast fallback
    const toast = document.createElement('div');
    toast.textContent = `⚠️ ${message}`;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      padding: '10px 14px',
      borderRadius: '10px',
      background: 'rgba(255, 71, 87, 0.15)',
      color: '#ff6b6b',
      border: '1px solid rgba(255, 71, 87, 0.3)',
      backdropFilter: 'blur(10px)',
      zIndex: '2147483647',
      fontSize: '13px',
      boxShadow: '0 6px 20px rgba(255, 71, 87, 0.2)'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // New: Unified enhancement options router
  showEnhancementOptions(parsedData) {
    if (this.isChatGPT()) {
      return this.showEnhancementOptionsChatGPT(parsedData);
    }
    return this.showEnhancementOptionsRegular(parsedData);
  }

  // New: Non-ChatGPT enhancement overlay
  showEnhancementOptionsRegular(parsedData) {
    try {
      // Remove any existing overlay
      this.removeExistingOverlay();

      const overlay = document.createElement('div');
      overlay.className = 'promptok-overlay';

      const optionsHTML = this.buildOptionsHTML(parsedData);
      overlay.innerHTML = `
        <div class="promptok-card enhanced" id="promptok-enhanced-card">
          <div class="promptok-header">
            <h4>✨ Enhanced Prompt Ready</h4>
            <div class="header-controls">
              <button class="promptok-minimize" aria-label="Minimize" title="Minimize">−</button>
              <button class="promptok-close" aria-label="Close">×</button>
            </div>
          </div>

          <div class="enhanced-prompt-preview">
            <h5>Base Enhanced Prompt:</h5>
            <div class="prompt-text">${this.escapeHtml(parsedData.enhanced_prompt)}</div>
          </div>

          <div class="options-section">
            <h5>Customize Your Prompt:</h5>
            <p class="options-description">Select options to further customize your enhanced prompt</p>
            ${optionsHTML}
          </div>

          <div class="promptok-actions">
            <button id="promptok-apply" class="primary">Apply</button>
            <button id="promptok-copy" class="copy-icon" title="Copy to clipboard">📋</button>
          </div>

          <div class="promptok-status"></div>
        </div>
      `;

      this.addOverlayStyles(overlay);
      this.addEnhancedStyles(overlay);
      document.body.appendChild(overlay);

      // Wire up listeners
      this.setupEnhancedEventListeners(overlay, parsedData);
    } catch (e) {
      console.error('[PromptOK] Failed to render enhancement overlay:', e);
      this.showError('Failed to render enhancement panel.');
    }
  }

  applySimpleEnhancement(enhancedText) {
    const input = this.detect();
    if (!input) return;

    this.setInputValue(input, enhancedText);
    this.showSuccess('Prompt enhanced!');
    setTimeout(() => this.removeExistingOverlay(), 1500);
  }

  showMinimizedButton() {
    // Remove any existing minimized button
    this.removeMinimizedButton();
    
    // Find the input field to position near it
    const input = this.currentInput || null;
    // If we don't have a currentInput (edge cases), fall back to detection
    const ensureInput = async () => input || await this.detect();
    // Create element first; we'll position after we ensure the input and sibling button
    const minimizedBtn = document.createElement('div');
    minimizedBtn.className = this.minimizedButtonClass;
    minimizedBtn.innerHTML = `✨`;
    minimizedBtn.title = `PromptOK enhancer (${this.selectedOptions.size} options selected)`;
    minimizedBtn.setAttribute('role', 'button');
    minimizedBtn.setAttribute('aria-label', 'Open PromptOK enhancement panel');
    // Insert into document body early so styles apply while we compute position
    document.body.appendChild(minimizedBtn);
    // Add styles
    this.addMinimizedButtonStyles(minimizedBtn);
    
    ensureInput().then((resolvedInput) => {
      if (!resolvedInput) return;
      // Position near the input field's enhance button if available
      this.positionMinimizedButton(resolvedInput, minimizedBtn);
      
      // Observe the floating button to keep the minimized icon in sync on size/position changes
      try {
        const inputId = resolvedInput.getAttribute('data-promptok-id');
        const siblingBtn = document.querySelector(`.${this.buttonClass}[data-input-id="${inputId}"]`);
        if (window.ResizeObserver && siblingBtn) {
          const ro = new ResizeObserver(() => this.positionMinimizedButton(resolvedInput, minimizedBtn, { siblingButton: siblingBtn }));
          ro.observe(siblingBtn);
          minimizedBtn._promptokResizeObserver = ro;
        }
      } catch (_) { /* ignore */ }
    });
    
    // Add click handler to restore
    minimizedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.debugLog('Minimized button clicked!');
      this.debugLog('Enhancement data exists:', !!this.currentEnhancementData);
      this.debugLog('Is minimized state:', this.isMinimized);
      this.restoreOverlay();
    });
    
    this.debugLog('Minimized button created and added to DOM');
  }

  restoreOverlay() {
    this.debugLog('Restoring overlay from minimized state');
    this.debugLog('Current enhancement data:', this.currentEnhancementData);
    this.debugLog('Is minimized:', this.isMinimized);
    
    if (!this.currentEnhancementData) {
      this.debugLog('No in-memory data, attempting to load session');
      // Try to load from session storage
      // Note: loadSessionState is async; restore path continues after load
      // because we are in event handler, we can use a microtask
      Promise.resolve().then(async () => {
        const loaded = await this.loadSessionState();
        this.debugLog('Session loaded:', loaded);
        if (!loaded || !this.currentEnhancementData) {
          this.debugLog('No enhancement data available to restore');
          return;
        }
        this.removeMinimizedButton();
        this.isMinimized = false;
        if (this.currentEnhancementData.structuredData) {
          this.debugLog('Restoring with structured data');
          this.showEnhancementOptions(this.currentEnhancementData.structuredData);
        } else {
          this.debugLog('Restoring with raw response data');
          const parsedData = this.parseEnhancementResponse(this.currentEnhancementData.rawResponse);
          if (parsedData) {
            this.showEnhancementOptions(parsedData);
          }
        }
      });
      return;
    }
    
    this.removeMinimizedButton();
    this.isMinimized = false;
    
    // Recreate the overlay with preserved data and selections
    if (this.currentEnhancementData.structuredData) {
      this.debugLog('Restoring with structured data');
      this.showEnhancementOptions(this.currentEnhancementData.structuredData);
    } else {
      this.debugLog('Restoring with raw response data');
      const parsedData = this.parseEnhancementResponse(this.currentEnhancementData.rawResponse);
      if (parsedData) {
        this.showEnhancementOptions(parsedData);
      }
    }
  }

  removeMinimizedButton() {
    const existing = document.querySelector(`.${this.minimizedButtonClass}`);
    if (existing) {
      try {
        if (existing._promptokResizeObserver) {
          existing._promptokResizeObserver.disconnect();
          delete existing._promptokResizeObserver;
        }
        existing.remove();
      } catch (_) { /* ignore */ }
    }
  }

  closeOverlay() {
    this.debugLog('Closing overlay completely');

    // Handle both ChatGPT and regular overlays
    const chatgptPanel = document.querySelector('.promptok-chatgpt-panel');
    const regularOverlay = document.querySelector(`.${this.overlayClass}`);

    if (chatgptPanel) {
      this.removeExistingChatGPTOverlay();
    } else if (regularOverlay) {
      regularOverlay.style.opacity = '0';
      setTimeout(() => regularOverlay.remove(), 400);
    }
  }

  removeExistingOverlay() {
    // Pure DOM cleanup: remove any existing overlay without touching state
    const existing = document.querySelector(`.${this.overlayClass}`);
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 400);
    }
  }

  addOverlayStyles(overlay) {
    const style = document.createElement('style');
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
        font-size: 18px;
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

      .promptok-loading {
        text-align: center;
        padding: 40px 20px;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 2px solid rgba(0, 112, 243, 0.1);
        border-top: 2px solid #00f0ff;
        border-right: 2px solid #667eea;
        border-radius: 50%;
        animation: spinNeon 1s linear infinite;
        margin: 0 auto 20px;
        box-shadow: 0 0 20px rgba(0, 112, 243, 0.3);
      }

      @keyframes spinNeon {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .promptok-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        align-items: center;
      }

      .promptok-actions button {
        flex: 1;
        padding: 12px 20px;
        border-radius: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-size: 14px;
        letter-spacing: -0.025em;
      }

      .promptok-actions button.primary {
        background: linear-gradient(135deg, #00f0ff 0%, #667eea 100%);
        color: #000;
        border: 1px solid rgba(0, 112, 243, 0.3);
        font-weight: 600;
        box-shadow: 0 6px 20px rgba(0, 112, 243, 0.3);
      }

      .promptok-actions button.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 112, 243, 0.4);
      }

      .promptok-actions button.copy-icon {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(0, 112, 243, 0.2);
        border-radius: 10px;
        color: #00f0ff;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        flex-shrink: 0;
        backdrop-filter: blur(10px);
      }

      .promptok-actions button.copy-icon:hover {
        background: rgba(0, 112, 243, 0.1);
        color: #00f0ff;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 112, 243, 0.3);
        border-color: rgba(0, 112, 243, 0.4);
      }

      .promptok-actions button.secondary {
        background: rgba(255, 255, 255, 0.05);
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
      }

      .promptok-actions button.secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-1px);
      }

      .promptok-status {
        margin-top: 16px;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        backdrop-filter: blur(10px);
      }

      .promptok-status.success {
        background: rgba(34, 197, 94, 0.1);
        color: #22f055;
        border: 1px solid rgba(34, 197, 94, 0.2);
      }

      .error-message {
        padding: 20px 0;
        text-align: center;
        color: #ff6b6b;
      }
    `;
    overlay.appendChild(style);
  }

  positionMinimizedButton(input, button, opts = {}) {
    try {
      const inputId = input.getAttribute('data-promptok-id');
      const siblingBtn = opts.siblingButton || document.querySelector(`.${this.buttonClass}[data-input-id="${inputId}"]`);
      const parent = (siblingBtn && siblingBtn.parentElement) || document.body;
      if (button.parentElement !== parent) parent.appendChild(button);

      // Ensure parent can host absolute children (avoid changing body)
      const cs = window.getComputedStyle(parent);
      if (cs.position === 'static' && parent !== document.body) {
        parent.style.setProperty('position', 'relative', 'important');
      }

      // Modern positioning: place minimized button to the left of the enhance button with better spacing
      let rightPx = 130; let bottomPx = 26;
      if (siblingBtn) {
        const r = parseFloat(siblingBtn.style.right) || 80;
        const b = parseFloat(siblingBtn.style.bottom) || 26;
        rightPx = r + 60; // 60px to the left of the enhance button (increase right)
        bottomPx = b + 6; // slightly lower for better visual balance
      }

      const s = (prop, val) => button.style.setProperty(prop, val, 'important');
      s('position', 'absolute');
      s('right', `${rightPx}px`);
      s('bottom', `${bottomPx}px`);
      s('left', 'auto');
      s('top', 'auto');
      s('z-index', '2147483647');

      // Add staggered animation delay for smooth appearance
      button.style.setProperty('animation-delay', '0.3s', 'important');

    } catch (_) { /* ignore */ }
  }

  addMinimizedButtonStyles(button) {
    const style = document.createElement('style');
    style.textContent = `
      .${this.minimizedButtonClass} {
        position: absolute !important;
        transform: none !important;
        background: linear-gradient(135deg, rgba(0, 112, 243, 0.9) 0%, rgba(0, 240, 255, 0.8) 100%) !important;
        border-radius: 16px !important;
        width: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 2147483647 !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border: 1px solid rgba(0, 240, 255, 0.4) !important;
        backdrop-filter: blur(15px) !important;
        -webkit-backdrop-filter: blur(15px) !important;
        font-size: 14px !important;
        color: #000 !important;
        box-shadow: 0 6px 20px rgba(0, 112, 243, 0.4), 0 3px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
        font-weight: 700 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
        position: relative !important;
        overflow: hidden !important;
      }

      .${this.minimizedButtonClass}::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        transition: left 0.5s ease;
      }

      .${this.minimizedButtonClass}:hover::before {
        left: 100%;
      }

      .${this.minimizedButtonClass}:hover {
        transform: translateY(-2px) scale(1.1) !important;
        background: linear-gradient(135deg, rgba(0, 112, 243, 1) 0%, rgba(0, 240, 255, 0.9) 100%) !important;
        box-shadow: 0 8px 25px rgba(0, 112, 243, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
      }

      .${this.minimizedButtonClass}:active {
        transform: translateY(0) scale(0.95) !important;
      }

      .minimized-count {
        position: absolute;
        top: -6px;
        right: -6px;
        background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
        color: white;
        font-size: 10px;
        font-weight: 700;
        min-width: 16px;
        height: 16px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        z-index: 1;
      }
    `;
    button.appendChild(style);
  }

  addEnhancedStyles(overlay) {
    const style = document.createElement('style');
    style.textContent = `
      .promptok-card.enhanced {
        width: min(1000px, 90vw);
        min-width: min(800px, 85vw);
        max-width: 95vw;
        max-height: 85vh;
        background: linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%);
        border: 1px solid rgba(0, 112, 243, 0.3);
        border-radius: 24px;
        box-shadow:
          0 32px 64px rgba(0, 0, 0, 0.8),
          0 16px 32px rgba(0, 112, 243, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        color: white;
        overflow: hidden;
        position: relative;
        animation: cardNeon 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
      }

      @keyframes cardNeon {
        from {
          transform: translateY(50px) scale(0.95);
          opacity: 0;
          box-shadow: 0 0 0 rgba(0, 112, 243, 0);
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
          box-shadow:
            0 32px 64px rgba(0, 0, 0, 0.8),
            0 16px 32px rgba(0, 112, 243, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
      }

      @media (max-width: 1200px) {
        .promptok-card.enhanced {
          width: min(900px, 88vw);
          min-width: min(700px, 80vw);
        }
      }

      @media (max-width: 900px) {
        .promptok-card.enhanced {
          width: min(800px, 85vw);
          min-width: min(600px, 75vw);
        }
      }

      @media (max-width: 600px) {
        .promptok-card.enhanced {
          width: 95vw;
          min-width: 320px;
          max-height: 80vh;
          border-radius: 20px;
        }
      }

      .promptok-card.enhanced .promptok-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0, 112, 243, 0.05);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(0, 112, 243, 0.15);
        padding: 20px 24px 16px;
        margin: 0;
      }

      .promptok-card.enhanced .promptok-header h4 {
        color: white;
        text-shadow: 0 0 20px rgba(0, 112, 243, 0.4);
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.03em;
        background: linear-gradient(135deg, #00f0ff 0%, #ffffff 50%, #667eea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .header-controls {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .promptok-card.enhanced .promptok-minimize,
      .promptok-card.enhanced .promptok-close {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(0, 112, 243, 0.1);
        border: 1px solid rgba(0, 112, 243, 0.2);
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        font-size: 18px;
        font-weight: 600;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .promptok-card.enhanced .promptok-minimize:hover,
      .promptok-card.enhanced .promptok-close:hover {
        background: rgba(0, 112, 243, 0.2);
        color: white;
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 8px 24px rgba(0, 112, 243, 0.3);
      }

      .enhanced-prompt-preview {
        margin: 20px 24px;
        padding: 20px;
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 16px;
        border: 1px solid rgba(0, 112, 243, 0.1);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        animation: previewGlow 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        animation-delay: 0.1s;
        animation-fill-mode: both;
      }

      @keyframes previewGlow {
        from {
          transform: translateY(20px) scale(0.98);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }

      .enhanced-prompt-preview h5 {
        margin: 0 0 14px 0;
        color: white;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.025em;
        text-shadow: 0 0 10px rgba(0, 112, 243, 0.3);
      }

      .prompt-text {
        background: rgba(0, 0, 0, 0.3);
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid rgba(0, 112, 243, 0.2);
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #00f0ff;
        max-height: 120px;
        overflow-y: auto;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 112, 243, 0.4) transparent;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.4);
      }

      .prompt-text::-webkit-scrollbar {
        width: 6px;
      }

      .prompt-text::-webkit-scrollbar-track {
        background: transparent;
      }

      .prompt-text::-webkit-scrollbar-thumb {
        background: rgba(0, 112, 243, 0.4);
        border-radius: 3px;
      }

      .prompt-text::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 112, 243, 0.6);
      }

      .options-section h5 {
        margin: 0 0 10px 0;
        color: white;
        font-size: 16px;
        font-weight: 600;
        text-shadow: 0 0 15px rgba(0, 112, 243, 0.4);
        letter-spacing: -0.025em;
      }

      .options-description {
        margin: 0 0 20px 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        line-height: 1.5;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.2);
      }

      .option-group {
        margin-bottom: 20px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 16px;
        border: 1px solid rgba(0, 112, 243, 0.1);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        animation: groupGlow 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        animation-delay: 0.2s;
        animation-fill-mode: both;
      }

      @keyframes groupGlow {
        from {
          transform: translateY(20px) scale(0.98);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }

      .option-group h6 {
        margin: 0 0 10px 0;
        color: white;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.025em;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.3);
      }

      .group-description {
        margin: 0 0 14px 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        line-height: 1.4;
      }

      .options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 14px;
      }

      .option-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 50px;
        border: 1px solid rgba(0, 112, 243, 0.2);
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        transform: scale(0.98);
        opacity: 0;
        animation: optionNeon 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        position: relative;
        overflow: hidden;
      }

      .option-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 112, 243, 0.1), transparent);
        transition: left 0.6s ease;
      }

      .option-item:hover::before {
        left: 100%;
      }

      @keyframes optionNeon {
        from {
          transform: translateY(20px) scale(0.95);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }

      .options .option-item:nth-child(1) { animation-delay: 0.3s; }
      .options .option-item:nth-child(2) { animation-delay: 0.4s; }
      .options .option-item:nth-child(3) { animation-delay: 0.5s; }
      .options .option-item:nth-child(4) { animation-delay: 0.6s; }
      .options .option-item:nth-child(5) { animation-delay: 0.7s; }
      .options .option-item:nth-child(6) { animation-delay: 0.8s; }

      .option-item:hover {
        border-color: rgba(0, 112, 243, 0.4);
        background: rgba(0, 112, 243, 0.1);
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 8px 24px rgba(0, 112, 243, 0.2);
      }

      .option-item input[type="checkbox"],
      .option-item input[type="radio"] {
        margin: 0;
        cursor: pointer;
        width: 18px;
        height: 18px;
        accent-color: #00f0ff;
        flex-shrink: 0;
      }

      .option-content {
        flex: 1;
        min-width: 0;
      }

      .option-label {
        display: block;
        font-weight: 600;
        color: white;
        margin-bottom: 3px;
        font-size: 13px;
        letter-spacing: -0.025em;
        line-height: 1.3;
        text-shadow: 0 0 6px rgba(0, 112, 243, 0.2);
      }

      .option-short {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.3;
        text-shadow: 0 0 4px rgba(0, 112, 243, 0.1);
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-label,
      .option-item input[type="radio"]:checked ~ .option-content .option-label {
        color: #00f0ff;
        font-weight: 700;
        text-shadow: 0 0 10px rgba(0, 112, 243, 0.5);
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-short,
      .option-item input[type="radio"]:checked ~ .option-content .option-short {
        color: rgba(0, 112, 243, 0.8);
        text-shadow: 0 0 6px rgba(0, 112, 243, 0.3);
      }
    `;
    overlay.appendChild(style);
  }

  addErrorStyles(overlay) {
    const style = document.createElement('style');
    style.textContent = `
      .promptok-card.error-card {
        max-width: 480px;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%);
        border: 1px solid rgba(255, 71, 87, 0.3);
        border-radius: 20px;
        color: white;
        box-shadow:
          0 25px 50px rgba(0, 0, 0, 0.8),
          0 12px 24px rgba(255, 71, 87, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
        animation: cardError 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes cardError {
        from {
          transform: translateY(40px) scale(0.95);
          opacity: 0;
          box-shadow: 0 0 0 rgba(255, 71, 87, 0);
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
          box-shadow:
            0 25px 50px rgba(0, 0, 0, 0.8),
            0 12px 24px rgba(255, 71, 87, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
      }

      .promptok-card.error-card .promptok-header h4 {
        color: white;
        font-weight: 700;
        text-shadow: 0 0 15px rgba(255, 71, 87, 0.4);
        font-size: 20px;
        letter-spacing: -0.025em;
        background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .promptok-card.error-card .promptok-close {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 71, 87, 0.1);
        border: 1px solid rgba(255, 71, 87, 0.2);
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-weight: 600;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .promptok-card.error-card .promptok-close:hover {
        background: rgba(255, 71, 87, 0.2);
        color: white;
        transform: translateY(-1px) scale(1.05);
        box-shadow: 0 6px 20px rgba(255, 71, 87, 0.3);
      }

      .error-message.auth-error,
      .error-message.rate-limit-error {
        padding: 28px 20px;
        text-align: center;
        color: white;
        background: rgba(255, 71, 87, 0.05);
        border-radius: 14px;
        border: 1px solid rgba(255, 71, 87, 0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        margin: 20px 0;
      }

      .error-message .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.9;
        filter: drop-shadow(0 4px 8px rgba(255, 71, 87, 0.3));
        animation: iconPulse 2s ease-in-out infinite;
      }

      @keyframes iconPulse {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-4px) scale(1.05); }
      }

      .error-message h3 {
        margin: 0 0 14px 0;
        font-size: 20px;
        font-weight: 700;
        color: white;
        text-shadow: 0 0 10px rgba(255, 71, 87, 0.4);
        letter-spacing: -0.025em;
        background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .error-message p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.8);
        text-shadow: 0 0 6px rgba(255, 71, 87, 0.2);
        opacity: 0.95;
      }

      .promptok-card.error-card .promptok-actions {
        border-top: 1px solid rgba(255, 71, 87, 0.1);
        padding-top: 20px;
        margin-top: 20px;
        background: rgba(255, 71, 87, 0.03);
        border-radius: 0 0 18px 18px;
        margin: 20px -24px -24px;
        padding: 20px 24px 24px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .promptok-card.error-card .action-button {
        background: linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 71, 87, 0.15) 100%);
        color: white;
        border: 1px solid rgba(255, 107, 107, 0.3);
        font-weight: 600;
        padding: 12px 24px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 6px 20px rgba(255, 107, 107, 0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 14px;
        letter-spacing: -0.025em;
      }

      .promptok-card.error-card .action-button:hover {
        background: linear-gradient(135deg, rgba(255, 107, 107, 0.3) 0%, rgba(255, 71, 87, 0.25) 100%);
        border-color: rgba(255, 107, 107, 0.5);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.2);
      }

      .promptok-card.error-card .action-button:active {
        transform: translateY(0);
      }

      .promptok-card.error-card .secondary {
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-weight: 500;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .promptok-card.error-card .secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
        color: white;
      }
    `;
    overlay.appendChild(style);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Enhanced Prompt Extension Initialization
class PromptEnhancerManager {
  constructor() {
    this.enhancer = new AdvancedPromptEnhancer();
    this.observer = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    
    this.enhancer.detect();
    this.setupObserver();
    this.isInitialized = true;
  }

  setupObserver() {
    if (this.observer) return;
    
    this.observer = new MutationObserver((mutations) => {
      // More intelligent throttling - only detect if relevant changes
      if (this.observerTimeout) return;
      
      // Check if mutations are relevant (new form elements, textareas, etc.)
      const hasRelevantChanges = mutations.some(mutation => {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          return addedNodes.some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const element = node;
            return element.tagName === 'TEXTAREA' ||
                   element.querySelector?.('textarea') ||
                   element.getAttribute?.('contenteditable') === 'true' ||
                   element.querySelector?.('[contenteditable="true"]');
          });
        }
        return false;
      });
      
      if (hasRelevantChanges) {
        this.observerTimeout = setTimeout(() => {
          this.enhancer.detect();
          this.observerTimeout = null;
        }, 200); // Slightly longer delay for better batching
      }
    });

    // More targeted observation
    this.observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }
  }
}

// Initialize only in top-level window to avoid sandboxed iframes
if (window.top === window) {
  // Initialize the enhancer
  const enhancer = new AdvancedPromptEnhancer();

  // Expose globally for debugging
  window.promptOKEnhancer = enhancer;

  // Start detection when DOM is ready (async)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await enhancer.detect();
    });
  } else {
    enhancer.detect().catch(console.error);
  }

  // Run detection periodically for dynamic content with adaptive timing
  let detectionInterval = 3000; // Start with 3 seconds
  let consecutiveNoChanges = 0;

  const periodicDetection = async () => {
    try {
      // Clean up orphaned buttons first
      enhancer.cleanupOrphanedButtons();
      
      const hadButtons = enhancer.floatingButtons.size;
      await enhancer.detect();
      const hasButtons = enhancer.floatingButtons.size;
      
      // Adaptive timing: slow down if no changes detected
      if (hadButtons === hasButtons) {
        consecutiveNoChanges++;
        if (consecutiveNoChanges > 3) {
          detectionInterval = Math.min(10000, detectionInterval * 1.5); // Max 10s
        }
      } else {
        consecutiveNoChanges = 0;
        detectionInterval = 3000; // Reset to fast detection
      }
      
    } catch (error) {
      console.error('[PromptOK] Periodic detection error:', error);
    }
    
    // Schedule next detection with adaptive timing
    setTimeout(periodicDetection, detectionInterval);
  };

  // Start periodic detection
  setTimeout(periodicDetection, 3000);
}
