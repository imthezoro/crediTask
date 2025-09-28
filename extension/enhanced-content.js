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
    // Font scaling persistence
    this.fontScaleKey = 'promptok.fontScale';
    this.fontScale = 1.1;
    this.userProfile = null;
    this.isAuthenticated = false;
    this.currentInput = null;
    this.processedInputs = new Set();
    this.floatingButtons = new Map(); // inputEl -> buttonEl
    this._repositionBound = null;
    this._mutationObserver = null;
    // Persist the latest enhancement payload so minimized icon can restore the same popup
    this.lastParsedData = null;
    
    // Debug mode - set to true for detailed logging
    this.debug = true;
    
    // Initialize authentication check
    this.initializeAuth();
    // Load user-preferred font scale
    this.loadFontScale().catch(() => {});
    
    // Clean up orphaned buttons on initialization
    this.cleanupOrphanedButtons();

    // Attach global listeners once for repositioning
    this.attachGlobalPositionListeners();

    // Apply site-level classes to document for CSS targeting
    try {
      if (window.PromptOK_Config && window.PromptOK_Styles) {
        const { flags } = window.PromptOK_Config.getSiteConfig(window.location && window.location.hostname);
        window.PromptOK_Styles.applyDocumentSiteClasses(flags);
      }
    } catch (_) { /* ignore */ }
  }

  createHistoryButton() {
    const b = document.createElement('button');
    b.className = 'promptok-history-button';
    const s = (p,v)=>b.style.setProperty(p,v,'important');
    s('position','fixed');
    s('width','26px'); s('height','26px');
    s('border-radius','10px');
    s('z-index','2147483647');
    s('display','flex'); s('align-items','center'); s('justify-content','center');
    s('background','rgba(0,0,0,0.75)'); s('color','#fff');
    s('border','1px solid rgba(255,255,255,0.2)');
    s('box-shadow','0 6px 16px rgba(0,0,0,0.35)');
    // Hidden by default; fade/slide in on hover
    s('opacity','0'); s('pointer-events','none');
    s('transition','opacity .18s ease, transform .18s ease');
    s('transform','translateX(6px)');
    b.setAttribute('aria-label', 'View history');
    b.setAttribute('title', 'View history');
    // Inline SVG: modern history/clock icon (stroke inherits currentColor)
    b.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
        <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    return b;
  }

  positionHistoryButtonNear(mainBtn, historyBtn){
    if (!mainBtn || !historyBtn) return;
    const s = (p,v)=>historyBtn.style.setProperty(p,v,'important');
    // Robust: always anchor in viewport next to main button rect (avoids parent clipping)
    try {
      const updatePos = () => {
        const rect = mainBtn.getBoundingClientRect();
        const size = 26; // history button size
        const gap = 12;  // visual gap between buttons
        const left = Math.max(8, rect.left - gap - size);
        const top = Math.max(8, rect.top + (rect.height - size) / 2);
        s('left', `${left}px`);
        s('top', `${top}px`);
        s('right', 'auto'); s('bottom', 'auto');
      };
      // Set immediately and on scroll/resize
      updatePos();
      // Re-run after layout settles to avoid transient 0,0 rects
      try { requestAnimationFrame(() => updatePos()); } catch(_) {}
      try { setTimeout(() => updatePos(), 50); } catch(_) {}
      if (!historyBtn._posUpdater) {
        historyBtn._posUpdater = updatePos;
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos, true);
        // Track main button size/position changes
        if (window.ResizeObserver) {
          const ro = new ResizeObserver(() => updatePos());
          ro.observe(mainBtn);
          historyBtn._posResizeObserver = ro;
        }
      }
    } catch(_) { /* noop */ }
  }

  // --- Reload icon swap (visual-only) ---
  getReloadSVG() {
    return (
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '  <path d="M20 12a8 8 0 1 1-2.343-5.657" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '  <path d="M20 4v6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  showReloadBadge(button){
    try {
      if (!button) return;
      if (button.classList.contains('loading')) return; // avoid fighting spinner
      if (!button._promptokDefaultIconHTML) {
        button._promptokDefaultIconHTML = button.innerHTML;
      }
      if (!button._promptokReloadActive) {
        button.innerHTML = this.getReloadSVG();
        button._promptokReloadActive = true;
      }
    } catch(_) { /* ignore */ }
  }

  hideReloadBadge(button){
    try {
      if (!button) return;
      if (button._promptokReloadActive) {
        const original = typeof button._promptokDefaultIconHTML === 'string' ? button._promptokDefaultIconHTML : '';
        if (original) button.innerHTML = original;
        button._promptokReloadActive = false;
      }
    } catch(_) { /* ignore */ }
  }

  updateReloadIndicator(button, input){
    try {
      if (!button || !input) return;
      if (button.classList.contains('loading')) { this.hideReloadBadge(button); return; }
      const last = input && input._promptokLastEnhancedValue ? String(input._promptokLastEnhancedValue) : '';
      const cur = input ? String(this.getInputValue(input) || '') : '';
      if (last && cur.trim() === last.trim()) {
        this.showReloadBadge(button);
      } else {
        this.hideReloadBadge(button);
      }
    } catch(_) { /* ignore */ }
  }

  async showHistoryForCurrentChat(){
    const jwtData = await this.getExtensionJWT();
    if (!jwtData.jwt) { this.showAuthRequired(); return; }
    const baseUrl = await window.promptokEnvConfig.getApiBase();
    let chatUrl = null; try { chatUrl = window.location && window.location.href; } catch(_){ }
    if (!chatUrl) { this.showError('Could not resolve chat URL'); return; }
    const url = new URL(`${baseUrl}/api/extension/history`);
    url.searchParams.set('chatUrl', chatUrl);
    url.searchParams.set('limit', '3');
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${jwtData.jwt}` } });
    if (!res.ok) { const err = await res.json().catch(()=>({})); this.showError('Failed to load history'); console.warn(err); return; }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    // Determine anchor rect (history button preferred)
    let anchorRect = null;
    try {
      const anchorEl = this._historyButtonEl || document.querySelector('.promptok-history-button');
      if (anchorEl) anchorRect = anchorEl.getBoundingClientRect();
    } catch(_) { }
    this.renderHistoryPopover(items, anchorRect);
  }

  renderHistoryPopover(items, anchorRect){
    // Create a small floating card near the history icon
    const pop = document.createElement('div');
    pop.className = 'promptok-history-popover';
    pop.setAttribute('data-history', '1');
    const s = (p,v)=>pop.style.setProperty(p,v,'important');
    s('position','fixed'); s('z-index','2147483647'); s('max-width','360px');
    s('background','rgba(10,10,10,0.96)'); s('backdrop-filter','blur(12px)'); s('-webkit-backdrop-filter','blur(12px)');
    s('border','1px solid rgba(255,255,255,0.12)'); s('border-radius','12px'); s('box-shadow','0 12px 32px rgba(0,0,0,0.45)');
    s('padding','10px'); s('color','#fff'); s('opacity','0'); s('transform','translateY(6px)'); s('transition','opacity .18s ease, transform .18s ease');
    pop.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 4px;">
        <div style="font-weight:600; font-size:12px; opacity:.9;">History</div>
        <button class="promptok-history-close" aria-label="Close" style="background:transparent;color:#fff;border:0;cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:40vh; overflow:auto;">
        ${items.map(it => {
          const raw = (it.final_prompt && String(it.final_prompt)) || (it.base_enhanced_prompt && String(it.base_enhanced_prompt)) || '';
          const cleaned = this.formatHistoryPrompt(raw);
          const safe = cleaned.replace(/</g,'&lt;');
          const when = (()=>{ try { return new Date(it.created_at).toLocaleString(); } catch(_) { return ''; } })();
          return `
            <div class="promptok-history-item" style="padding:10px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; background:rgba(255,255,255,0.04); cursor:pointer" data-item="${encodeURIComponent(JSON.stringify(it))}">
              <div style="font-size:11px; opacity:.65;">${when}</div>
              <div style="margin-top:6px; white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; line-height:1.45;">${safe}</div>
            </div>
          `;
        }).join('')}
        ${items.length === 0 ? '<div style="opacity:.8; font-size:12px; padding:4px 6px;">No history for this chat.</div>' : ''}
      </div>
    `;
    document.body.appendChild(pop);

    // Position relative to anchor rect (above the history icon, centered)
    const placePopover = () => {
      try {
        const rect = anchorRect || (this._historyButtonEl && this._historyButtonEl.getBoundingClientRect());
        if (!rect) return;
        // Measure
        const pr = pop.getBoundingClientRect();
        let left = rect.left + rect.width/2 - pr.width/2;
        left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
        let top = rect.top - pr.height - 8; // above icon
        if (top < 8) { // not enough space above, place below
          top = rect.bottom + 8;
        }
        s('left', `${Math.round(left)}px`);
        s('top', `${Math.round(top)}px`);
      } catch(_) {}
    };
    // First layout, then animate in
    placePopover();
    requestAnimationFrame(() => { s('opacity','1'); s('transform','translateY(0)'); });

    // Close handlers
    const close = () => { try { pop.remove(); } catch(_){} };
    const closeBtn = pop.querySelector('.promptok-history-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    const outside = (e) => { if (!pop.contains(e.target) && !this._historyButtonEl?.contains(e.target)) { close(); document.removeEventListener('mousedown', outside, true); } };
    document.addEventListener('mousedown', outside, true);

    // Click handling: open the enhancement popup with this history record's data
    try {
      const clickable = Array.from(pop.querySelectorAll('.promptok-history-item'));
      clickable.forEach((el) => {
        el.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          // Close the history popover
          close();
          // Build parsedData from the history item
          let item = null;
          try {
            const raw = el.getAttribute('data-item') || '%7B%7D';
            // data-item is URI-encoded JSON string; decode safely
            item = JSON.parse(decodeURIComponent(raw));
          } catch(_) { item = {}; }
          const parsedData = await this.buildParsedDataFromHistoryItem(item);
          if (!parsedData || !parsedData.enhanced_prompt) {
            this.showError('Could not parse history entry.');
            return;
          }
          // Reset selection to default for re-apply
          this.selectedOptions.clear();
          // Persist last parsed data so minimized button can restore
          this.lastParsedData = parsedData;
          // Show the options panel populated with this history record
          try {
            await this.showEnhancementOptions(parsedData);
          } catch(err) {
            console.warn('[PromptOK] Failed to open enhancement panel from history', err);
            this.showError('Failed to open enhancement panel.');
          }
        }, { once: true });
      });
    } catch(_) { /* noop */ }
  }

  // Sanitize history text to show exactly what the user saw in the enhancement popup
  // - Prefer final prompt; else base enhanced prompt
  // - Remove internal headings like **Enhanced Prompt**
  // - Remove fenced code blocks (``` ... ```), especially JSON
  // - Trim excessive whitespace
  formatHistoryPrompt(text) {
    try {
      const original = String(text || '');
      let t = original;

      // 1) Try to extract the explicit "Enhanced Prompt" section until a separator (---), code fence, or end
      //    This mirrors what the popup displays as the primary enhanced text.
      const sectionMatch = t.match(/\*\*\s*Enhanced\s+Prompt\s*\*\*[\s:]*\n?([\s\S]*?)(?:\n-{3,}|\n```|$)/i);
      if (sectionMatch && sectionMatch[1]) {
        const extracted = sectionMatch[1].trim();
        if (extracted) {
          return extracted;
        }
      }

      // 2) Try to parse fenced JSON and use enhanced_prompt field directly, if present
      try {
        const jsonFence = t.match(/```json\s*([\s\S]*?)```/i);
        if (jsonFence && jsonFence[1]) {
          const parsed = JSON.parse(jsonFence[1]);
          const ep = parsed && typeof parsed.enhanced_prompt === 'string' ? parsed.enhanced_prompt.trim() : '';
          if (ep) return ep;
        }
      } catch (_) { /* ignore JSON parse errors */ }

      // 3) As a fallback, remove headings and code blocks and return remaining meaningful text
      t = t.replace(/^\s*\*\*\s*Enhanced\s+Prompt\s*\*\*\s*:?.*$/gmi, '').trim();
      t = t.replace(/```[\s\S]*?```/g, '').trim();
      t = t.replace(/^[-*_]{3,}\s*$/gmi, '').trim();
      t = t.replace(/\n{3,}/g, '\n\n');

      // If still empty, just return the original text (safeguard against blank rendering)
      return t || original.trim();
    } catch (_) {
      return String(text || '');
    }
  }

  // Session persistence helpers
  async setStorageItem(key, value) {
    try {
      if (window.PromptOK_State && typeof window.PromptOK_State.setItem === 'function') {
        await window.PromptOK_State.setItem(key, value);
      } else if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
      } else if (window.localStorage) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Failed to set storage item '${key}':`, error);
    }
  }

  async getStorageItem(key) {
    try {
      if (window.PromptOK_State && typeof window.PromptOK_State.getItem === 'function') {
        return await window.PromptOK_State.getItem(key);
      } else if (chrome?.storage?.local) {
        const out = await chrome.storage.local.get([key]);
        return out?.[key];
      } else if (window.localStorage) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (error) {
      console.warn(`Failed to get storage item '${key}':`, error);
    }
    return null;
  }

  // Panel size persistence helpers
  getPanelSizeKey() {
    const hostname = window.location.hostname;
    return `promptok.panelSize.${hostname}`;
  }

  async savePanelSize(width, height, top, left) {
    const key = this.getPanelSizeKey();
    const sizeData = { width, height, top, left, timestamp: Date.now() };
    await this.setStorageItem(key, sizeData);
    this.debugLog('Panel size saved for', window.location.hostname, sizeData);
  }

  async loadPanelSize() {
    const key = this.getPanelSizeKey();
    const sizeData = await this.getStorageItem(key);
    if (sizeData) {
      this.debugLog('Panel size loaded for', window.location.hostname, sizeData);
      return sizeData;
    }
    return null;
  }

  async loadFontScale() {
    const saved = await this.getStorageItem(this.fontScaleKey);
    if (typeof saved === 'number' && isFinite(saved)) {
      this.fontScale = this.clampFontScale(saved);
      this.applyFontScaleToExisting();
    }
  }

  clampFontScale(val) {
    const v = Number(val);
    if (!isFinite(v)) return 1;
    return Math.min(1.8, Math.max(0.8, Math.round(v * 10) / 10));
  }

  async setFontScale(val) {
    this.fontScale = this.clampFontScale(val);
    await this.setStorageItem(this.fontScaleKey, this.fontScale);
    this.applyFontScaleToExisting();
  }

  adjustFontScale(delta) {
    const next = this.fontScale + delta;
    return this.setFontScale(next);
  }

  applyFontScaleToExisting() {
    try {
      const chatPanel = document.querySelector('.promptok-chatgpt-panel');
      if (chatPanel) {
        chatPanel.style.setProperty('--promptok-font-scale', String(this.fontScale));
        const disp = chatPanel.querySelector('.font-scale-display');
        if (disp) disp.textContent = `${Math.round(this.fontScale * 100)}%`;
      }
      const enhancedCard = document.querySelector('.promptok-card.enhanced');
      if (enhancedCard) {
        enhancedCard.style.setProperty('--promptok-font-scale', String(this.fontScale));
        const disp2 = enhancedCard.querySelector('.font-scale-display');
        if (disp2) disp2.textContent = `${Math.round(this.fontScale * 100)}%`;
      }
    } catch (_) { /* ignore */ }
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
      if (window.PromptOK_State && typeof window.PromptOK_State.removeItem === 'function') {
        await window.PromptOK_State.removeItem(this.sessionStorageKey);
      } else if (chrome?.storage?.local) {
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
  async testApply() {
    this.debugLog('Testing apply functionality...');
    const testPrompt = "This is a test prompt to verify the apply button works.";
    await this.applyPromptToInput(testPrompt);
  }

  // Removed site-specific selector hook; detection is now globally consistent

  // Deep query across shadow roots
  queryDeepAll(selector, root = document) {
    try {
      if (window.PromptOK_DOM && typeof window.PromptOK_DOM.queryDeepAll === 'function') {
        return window.PromptOK_DOM.queryDeepAll(selector, root);
      }
    } catch (_) { /* ignore */ }
    // Fallback simple query
    try { return Array.from((root || document).querySelectorAll(selector)); } catch (_) { return []; }
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

    // Global selector strategy across all sites
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
    // Use only the generic selectors for uniform behavior
    const selectors = genericSelectors;
    this.debugLog('Global input detection active (no site-specific selectors). Selector count:', selectors.length);
    
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
    try {
      if (window.PromptOK_DOM && typeof window.PromptOK_DOM.isValidInput === 'function') {
        return window.PromptOK_DOM.isValidInput(element);
      }
    } catch (e) {
      this.debugLog('Error validating input:', e);
    }
    // Global fallback validation
    try {
      if (!element || !(element instanceof Element)) return false;
      // Exclude our own UI/panel elements
      if (element.closest && element.closest('.promptok-chatgpt-panel, .promptok-overlay, .promptok-enhance-button')) return false;
      const tag = (element.tagName || '').toUpperCase();
      const editable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
      const roleTextbox = (element.getAttribute && element.getAttribute('role')) === 'textbox';
      const isTextArea = tag === 'TEXTAREA';
      const isTextInput = tag === 'INPUT' && element.getAttribute('type') === 'text';
      const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
      const readonly = element.hasAttribute('readonly');
      // Visibility check
      const cs = window.getComputedStyle(element);
      const visible = cs && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      // Basic size check
      const rect = element.getBoundingClientRect();
      const sizeOk = rect && rect.width >= 80 && rect.height >= 20;
      return !disabled && !readonly && visible && sizeOk && (editable || roleTextbox || isTextArea || isTextInput);
    } catch (_) {
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
    // Initial badge update based on current input state
    try { this.updateReloadIndicator(button, input); } catch(_){}
    
    // Mark input as having button
    input.classList.add('promptok-input-with-button');
  }

  createEnhanceButton(input) {
    try {
      const inputId = input.getAttribute('data-promptok-id');
      if (window.PromptOK_UI && typeof window.PromptOK_UI.createEnhanceButton === 'function') {
        return window.PromptOK_UI.createEnhanceButton({ inputId, zIndex: 2147483647, size: 32 });
      }
    } catch (_) { /* ignore */ }
    // Fallback to basic button if UI helper unavailable
    const button = document.createElement('button');
    button.className = `${this.buttonClass} promptok-enhance-button`;
    button.setAttribute('data-input-id', input.getAttribute('data-promptok-id'));
    return button;
  }

  // Toggle loading state on the floating button with tooltip support
  setButtonLoading(button, isLoading, message = 'Enhancing…') {
    try {
      if (window.PromptOK_UI && typeof window.PromptOK_UI.setButtonLoading === 'function') {
        return window.PromptOK_UI.setButtonLoading(button, isLoading, message);
      }
    } catch (_) { /* ignore */ }
  }

  // Ensure a tooltip element exists for the button and update its text/visibility
  updateButtonTooltip(button, text, show) {
    try {
      if (window.PromptOK_UI && typeof window.PromptOK_UI.updateButtonTooltip === 'function') {
        return window.PromptOK_UI.updateButtonTooltip(button, text, show);
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
    // Ensure history hover button exists and is positioned near the main button
    try {
      if (!button._promptokHistoryButton) {
        const hbtn = this.createHistoryButton();
        this.debugLog('Creating history button near main enhance button');
        button._promptokHistoryButton = hbtn;
        // Keep a reference on the instance for anchoring the popover
        this._historyButtonEl = hbtn;
        try {
          // Append to body so position:fixed isn't affected by transformed ancestors
          document.body.appendChild(hbtn);
        } catch(_) {
          parent.appendChild(hbtn);
        }
        // Hover interactions: show when over either icon; debounce hide so moving between icons doesn't retract
        let visHideTimer = null;
        const show = () => {
          if (visHideTimer) { try { clearTimeout(visHideTimer); } catch(_){} visHideTimer = null; }
          hbtn.style.setProperty('opacity', '1', 'important');
          hbtn.style.setProperty('transform', 'translateX(0)', 'important');
          hbtn.style.setProperty('pointer-events', 'auto', 'important');
        };
        const hideNow = () => {
          if (visHideTimer) { try { clearTimeout(visHideTimer); } catch(_){} visHideTimer = null; }
          hbtn.style.setProperty('opacity', '0', 'important');
          hbtn.style.setProperty('transform', 'translateX(6px)', 'important');
          hbtn.style.setProperty('pointer-events', 'none', 'important');
        };
        const scheduleHideIfNoneHovered = () => {
          if (visHideTimer) { try { clearTimeout(visHideTimer); } catch(_){} }
          visHideTimer = setTimeout(() => {
            const overMainNow = button.matches(':hover');
            const overHistNow = hbtn.matches(':hover');
            if (!overMainNow && !overHistNow) hideNow();
          }, 140); // small debounce to allow moving from main -> history
        };
        const handleEnter = () => show();
        const handleLeave = () => scheduleHideIfNoneHovered();
        button.addEventListener('mouseenter', handleEnter);
        button.addEventListener('mouseleave', handleLeave);
        hbtn.addEventListener('mouseenter', handleEnter);
        hbtn.addEventListener('mouseleave', handleLeave);
        // Click on history icon: toggle history popover (open/close)
        hbtn.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          const existing = document.querySelector('.promptok-history-popover[data-history="1"]');
          if (existing) { try { existing.remove(); } catch(_) {} return; }
          try { await this.showHistoryForCurrentChat(); } catch(err){ console.warn('[PromptOK] history load failed', err);} 
        });
        // No auto-reveal: icon remains hidden until hovered over the enhance icon
      }
      this.positionHistoryButtonNear(button, button._promptokHistoryButton);
    } catch(_){}
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
    // Global behavior: keep button always visible regardless of site/scroll state
    try {
      button.style.setProperty('display', 'flex', 'important');
    } catch (_) { /* ignore */ }
  }

  // Find the closest ancestor that does NOT have scrollable overflow so the icon stays put when inner content scrolls
  findClosestNonScrollableAncestor(el) {
    try {
      if (window.PromptOK_DOM && typeof window.PromptOK_DOM.findClosestNonScrollableAncestor === 'function') {
        return window.PromptOK_DOM.findClosestNonScrollableAncestor(el);
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  // Gemini-specific: find an ancestor above the leading actions/toolbox/uploader wrappers
  // to avoid being occluded by their stacking contexts.
  findGeminiAnchor(el) {
    try {
      if (window.PromptOK_DOM && typeof window.PromptOK_DOM.findGeminiAnchor === 'function') {
        return window.PromptOK_DOM.findGeminiAnchor(el);
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  updateFloatingButtonPosition(input, button) {
    try {
      // Per-site offsets via config helper
      let rightOffset = 60, bottomOffset = 12;
      try {
        if (window.PromptOK_Config && typeof window.PromptOK_Config.getSiteConfig === 'function') {
          const { offsets } = window.PromptOK_Config.getSiteConfig(window.location && window.location.hostname);
          rightOffset = offsets.right;
          bottomOffset = offsets.bottom;
        }
      } catch (_) { /* ignore */ }

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
    // Track live changes to toggle reload indicator
    const onInputChange = () => {
      try { this.updateReloadIndicator(button, input); } catch(_){}
    };
    try {
      input.addEventListener('input', onInputChange);
      input.addEventListener('change', onInputChange);
    } catch(_) { /* ignore */ }
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Prevent duplicate requests if loading
      if (button.classList.contains('loading')) {
        return;
      }
      // Set the current input context
      this.currentInput = input;
      // Snapshot current text so we can show reload if user hasn't changed it
      try {
        input._promptokLastEnhancedValue = String(this.getInputValue(input) || '');
        this.updateReloadIndicator(button, input);
      } catch(_) { /* ignore */ }
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
        // Refresh reload state after enhancement completes (even if user didn't apply)
        try { this.updateReloadIndicator(button, this.currentInput || input); } catch(_) { /* ignore */ }
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
      structuredData: data.structuredData,
      sessionId: data.sessionId || null,
      responseTimeMs: data.responseTimeMs || null,
      site: data.site || null,
    };
  }

  async getExtensionJWT() {
    try {
      if (window.PromptOK_Auth && typeof window.PromptOK_Auth.getExtensionJWT === 'function') {
        const response = await window.PromptOK_Auth.getExtensionJWT();
        if (response && response.jwt) return response;
        return { jwt: null, expiresAt: null };
      }
      // Fallback to original implementation if helper missing
      const response = await chrome.runtime.sendMessage({ type: 'GET_EXTENSION_JWT' });
      if (response && response.jwt) return response;
      return { jwt: null, expiresAt: null };
    } catch (error) {
      const msg = (error && (error.message || String(error))) || '';
      if (typeof msg === 'string' && msg.toLowerCase().includes('extension context invalidated')) {
        console.warn('[PromptOK Content] Extension context invalidated. Please refresh the page and open the PromptOK popup once to reinitialize.');
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
    // Derive site label
    let site = 'unknown';
    try {
      if (window.PromptOK_Config && typeof window.PromptOK_Config.getSiteName === 'function') {
        site = window.PromptOK_Config.getSiteName(window.location && window.location.hostname);
      }
    } catch (_) { /* ignore */ }
    // Derive chat URL (session identifier)
    let chatUrl = null;
    try {
      chatUrl = (window.location && window.location.href) || null;
    } catch (_) { /* ignore */ }
    
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
      body: JSON.stringify({ prompt, site, chatUrl })
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

  async finalizeSession(finalPrompt, statusOverride) {
    try {
      const sessionId = this.currentEnhancementData && this.currentEnhancementData.sessionId;
      if (!sessionId) return;
      const jwtData = await this.getExtensionJWT();
      if (!jwtData.jwt) return;
      const baseUrl = await window.promptokEnvConfig.getApiBase();
      const res = await fetch(`${baseUrl}/api/extension/session/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtData.jwt}`,
        },
        body: JSON.stringify({ sessionId, finalPrompt, status: statusOverride || 'completed' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[PromptOK] finalizeSession failed', res.status, err);
      }
    } catch (e) {
      console.warn('[PromptOK] finalizeSession error', e);
    }
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
        this.debugLog('No structured JSON found in enhancement response; using simple enhancement.');
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
    // 1) Try to parse entire response as JSON
    try {
      const trimmed = (responseText || '').trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        JSON.parse(trimmed);
        return trimmed;
      }
    } catch (_) { /* ignore */ }

    // 2) Try to find fenced ```json blocks
    let jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }

    // 3) Try any fenced ``` block and see if it parses
    let genericMatch = responseText.match(/```\s*([\s\S]*?)```/i);
    if (genericMatch && genericMatch[1]) {
      const candidate = genericMatch[1].trim();
      try { JSON.parse(candidate); return candidate; } catch(_) {}
    }

    // 4) Heuristic: take substring from first '{' to last '}' and try parse
    try {
      const first = responseText.indexOf('{');
      const last = responseText.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        const candidate = responseText.substring(first, last + 1).trim();
        JSON.parse(candidate);
        return candidate;
      }
    } catch (_) { /* ignore */ }

    // 5) Truncated fenced json (no closing backticks)
    const truncMatch = responseText.match(/```json\s*([\s\S]*?)$/i);
    if (truncMatch && truncMatch[1]) {
      let jsonText = truncMatch[1].trim();
      const lastCompleteObject = this.findLastCompleteJson(jsonText);
      if (lastCompleteObject) return lastCompleteObject;
    }

    // Nothing structured found
    return null;
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

  async showLoadingOverlayChatGPT() {
    this.removeExistingOverlay();

    // Create a right-side panel instead of full-screen overlay
    const panel = document.createElement('div');
    // Create dim/blurred backdrop for ambiance
    const backdrop = document.createElement('div');
    backdrop.className = 'promptok-panel-backdrop';
    panel.className = 'promptok-chatgpt-panel';
    
    // Load saved panel size for this domain
    const savedSize = await this.loadPanelSize();
    if (savedSize) {
      // Apply saved dimensions
      panel.style.setProperty('width', `${savedSize.width}px`, 'important');
      panel.style.setProperty('height', `${savedSize.height}px`, 'important');
      panel.style.setProperty('top', `${savedSize.top}px`, 'important');
      panel.style.setProperty('left', `${savedSize.left}px`, 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    }
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>✨ Enhancing...</h4>
        <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="loading-spinner"></div>
        <p>AI is analyzing and improving your prompt</p>
      </div>
      
      <!-- Resize handles -->
      <div class="promptok-resize-handle promptok-resize-n" data-direction="n"></div>
      <div class="promptok-resize-handle promptok-resize-s" data-direction="s"></div>
      <div class="promptok-resize-handle promptok-resize-e" data-direction="e"></div>
      <div class="promptok-resize-handle promptok-resize-w" data-direction="w"></div>
      <div class="promptok-resize-handle promptok-resize-ne" data-direction="ne"></div>
      <div class="promptok-resize-handle promptok-resize-nw" data-direction="nw"></div>
      <div class="promptok-resize-handle promptok-resize-se" data-direction="se"></div>
      <div class="promptok-resize-handle promptok-resize-sw" data-direction="sw"></div>
    `;

    this.addChatGPTStyles(panel);
    // Apply global panel theme styling
    if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelGlobalStyles === 'function') {
      window.PromptOK_UI.addChatPanelGlobalStyles(panel);
    } else if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelPerplexityStyles === 'function') {
      // Backward-compat alias (to be removed later)
      window.PromptOK_UI.addChatPanelPerplexityStyles(panel);
    }
    panel.style.setProperty('--promptok-font-scale', String(this.fontScale));
    // Dock to right: full height from top to bottom
    try {
      panel.style.setProperty('top', '0', 'important');
      panel.style.setProperty('right', '0', 'important');
      panel.style.setProperty('bottom', '0', 'important');
      panel.style.setProperty('left', 'auto', 'important');
      panel.style.setProperty('height', '100vh', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    } catch (_) {}
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // Clicking backdrop minimizes the panel
    backdrop.addEventListener('click', () => this.minimizeChatGPTOverlay(panel));

    // Add resize functionality
    this.makeResizable(panel);

    // Add minimize listener
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    minimizeBtn.addEventListener('click', () => this.minimizeChatGPTOverlay(panel));

    // Auto-minimize when clicking outside the panel
    const outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    // Add slight delay to prevent immediate triggering
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);

    // Minimize on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  async showEnhancementOptionsChatGPT(parsedData) {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel';
    
    // Load saved panel size for this domain
    const savedSize = await this.loadPanelSize();
    if (savedSize) {
      // Apply saved dimensions
      panel.style.setProperty('width', `${savedSize.width}px`, 'important');
      panel.style.setProperty('height', `${savedSize.height}px`, 'important');
      panel.style.setProperty('top', `${savedSize.top}px`, 'important');
      panel.style.setProperty('left', `${savedSize.left}px`, 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    }
    panel.setAttribute('data-enhancement-data', JSON.stringify(parsedData));
    // Keep a copy for minimized restore flow
    try { this.lastParsedData = parsedData; } catch(_) {}

    // Build the options UI
    const optionsHTML = this.buildOptionsHTML(parsedData);

    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>✨ Enhanced Prompt Ready</h4>
        <div class="header-controls">
          <div class="font-scale-controls" title="Text size">
            <button class="font-trigger" aria-label="Adjust text size">
              <svg class="font-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"/>
                <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="font-popover">
              <button class="font-decrease" aria-label="Decrease text size">
                <svg class="font-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <span class="font-scale-display">100%</span>
              <button class="font-increase" aria-label="Increase text size">
                <svg class="font-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
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
      
      <!-- Resize handles -->
      <div class="promptok-resize-handle promptok-resize-n" data-direction="n"></div>
      <div class="promptok-resize-handle promptok-resize-s" data-direction="s"></div>
      <div class="promptok-resize-handle promptok-resize-e" data-direction="e"></div>
      <div class="promptok-resize-handle promptok-resize-w" data-direction="w"></div>
      <div class="promptok-resize-handle promptok-resize-ne" data-direction="ne"></div>
      <div class="promptok-resize-handle promptok-resize-nw" data-direction="nw"></div>
      <div class="promptok-resize-handle promptok-resize-se" data-direction="se"></div>
      <div class="promptok-resize-handle promptok-resize-sw" data-direction="sw"></div>
    `;

    this.addChatGPTStyles(panel);
    // Apply global ambient theme
    if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelGlobalStyles === 'function') {
      window.PromptOK_UI.addChatPanelGlobalStyles(panel);
    } else if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelPerplexityStyles === 'function') {
      window.PromptOK_UI.addChatPanelPerplexityStyles(panel);
    }
    // Apply saved/user-selected font scale to container so all children inherit
    panel.style.setProperty('--promptok-font-scale', String(this.fontScale));
    // Dock to right: full height from top to bottom
    try {
      panel.style.setProperty('top', '0', 'important');
      panel.style.setProperty('right', '0', 'important');
      panel.style.setProperty('bottom', '0', 'important');
      panel.style.setProperty('left', 'auto', 'important');
      panel.style.setProperty('height', '100vh', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    } catch (_) {}
    document.body.appendChild(panel);

    // Add resize functionality
    this.makeResizable(panel);

    // Add event listeners
    this.setupChatGPTEventListeners(panel, parsedData);
  }

  // Build a parsed enhancement payload from a history API item
  async buildParsedDataFromHistoryItem(item) {
    try {
      // 1) If server already stored structured fields
      if (item && typeof item === 'object') {
        if (item.parsed_data && item.parsed_data.enhanced_prompt && item.parsed_data.assumption_groups) {
          return item.parsed_data;
        }
        if (item.enhanced_prompt && item.assumption_groups) {
          return { enhanced_prompt: String(item.enhanced_prompt), assumption_groups: item.assumption_groups };
        }
      }
      // 2) Try to extract JSON from final_prompt or base_enhanced_prompt
      const raw = (item && (item.final_prompt || item.base_enhanced_prompt)) ? String(item.final_prompt || item.base_enhanced_prompt) : '';
      if (raw) {
        try {
          const jsonText = this.extractJsonFromResponse(raw);
          if (jsonText) {
            const parsed = JSON.parse(jsonText);
            if (parsed && parsed.enhanced_prompt && parsed.assumption_groups) {
              return parsed;
            }
          }
        } catch(_) { /* ignore */ }
      }
      // 3) Fallback: use formatted text as enhanced_prompt with no options
      const fallback = this.formatHistoryPrompt(raw);
      return { enhanced_prompt: fallback, assumption_groups: [] };
    } catch(_) {
      return null;
    }
  }

  // Create or update a minimized button that restores the last popup
  showMinimizedButton() {
    try {
      // Remove any existing minimized button first to avoid duplicates
      this.removeMinimizedButton();
      const btn = document.createElement('button');
      btn.className = this.minimizedButtonClass;
      const s = (p,v)=>btn.style.setProperty(p,v,'important');
      s('position','fixed'); s('right','16px'); s('bottom','16px');
      s('z-index','2147483647'); s('width','40px'); s('height','40px');
      s('border-radius','12px'); s('background','rgba(10,10,10,0.9)'); s('color','#fff');
      s('border','1px solid rgba(255,255,255,0.18)'); s('box-shadow','0 10px 24px rgba(0,0,0,0.5)');
      s('display','flex'); s('align-items','center'); s('justify-content','center');
      s('cursor','pointer');
      btn.title = 'Restore PromptOK panel';
      btn.innerHTML = `
        <span class="minimized-count" style="position:absolute; top:-6px; right:-6px; background:#38bdf8; color:#001018; font-weight:700; font-size:11px; width:20px; height:20px; border-radius:999px; display:none; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,0.35)"></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="2" ry="2" stroke="currentColor" stroke-width="1.8"/>
          <path d="M7 10h10M7 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      `;
      btn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        // Restore only if we have something to show
        const data = this.lastParsedData;
        if (!data) { this.removeMinimizedButton(); return; }
        this.isMinimized = false;
        try { this.removeMinimizedButton(); } catch(_) {}
        try {
          await this.showEnhancementOptions(data);
        } catch(err) {
          console.warn('[PromptOK] Failed to restore panel from minimized', err);
          this.showError('Failed to restore panel.');
        }
      });
      document.body.appendChild(btn);
      // Reflect current selection count
      this.updateMinimizedButtonCount();
    } catch(_) { /* noop */ }
  }

  removeMinimizedButton() {
    try {
      const el = document.querySelector(`.${this.minimizedButtonClass}`);
      if (el) el.remove();
    } catch(_) { /* noop */ }
  }

  addChatGPTStyles(panel) {
    const style = document.createElement('style');
    style.textContent = `
      .promptok-chatgpt-panel {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 420px !important;
        max-height: none !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        /* Base font scaling so all descendants inherit, ensures reload reflects saved zoom */
        font-size: calc(14px * var(--promptok-font-scale, 1)) !important;
        /* Unified ambient theme */
        background:
          radial-gradient(1200px 600px at 8% 0%, rgba(56, 189, 248, 0.10), transparent 55%),
          radial-gradient(1000px 500px at 92% 8%, rgba(192, 132, 252, 0.12), transparent 55%),
          linear-gradient(180deg, rgba(9, 12, 22, 0.96) 0%, rgba(13, 16, 27, 0.96) 100%) !important;
        border: 1px solid rgba(56, 189, 248, 0.22) !important;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.75), 0 14px 28px rgba(56, 189, 248, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.12) !important;
        display: flex !important;
        flex-direction: column !important;
        backdrop-filter: blur(25px) !important;
        -webkit-backdrop-filter: blur(25px) !important;
        animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        overflow: hidden !important;
        --promptok-font-scale: 1;
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
        background: linear-gradient(180deg, rgba(56,189,248,0.10), rgba(56,189,248,0.06)) !important;
        border-bottom: 1px solid rgba(56, 189, 248, 0.22) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        flex-shrink: 0 !important;
      }

      .promptok-chatgpt-header h4 {
        margin: 0 !important;
        color: white !important;
        font-size: calc(16px * var(--promptok-font-scale)) !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        background: linear-gradient(135deg, #22d3ee 0%, #c084fc 50%, #60a5fa 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        text-shadow: 0 0 15px rgba(56, 189, 248, 0.35) !important;
      }

      .header-controls {
        display: flex !important;
        gap: 8px !important;
        align-items: center !important;
      }

      .font-scale-controls { position: relative !important; display: inline-flex !important; overflow: visible !important; }
      .font-scale-controls .font-trigger {
        color: rgba(255,255,255,0.9) !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        cursor: pointer !important; transition: all 0.2s ease !important;
        backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;
      }
      .font-scale-controls .font-trigger:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.2) !important; }
      .font-scale-controls .font-icon { display: block !important; opacity: 0.9 !important; }
      .font-scale-controls .font-popover {
        position: absolute !important;
        top: 28px !important;
        right: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 10px !important;
        background: linear-gradient(135deg, rgba(196,132,252,0.12), rgba(147,51,234,0.1)) !important;
        border: 1px solid rgba(196,132,252,0.25) !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
        opacity: 0 !important; pointer-events: none !important; transform: translateY(-2px) !important;
        transition: opacity .15s ease, transform .15s ease !important;
        z-index: 2 !important;
      }
      .font-scale-controls:hover .font-popover,
      .font-scale-controls.open .font-popover { opacity: 1 !important; pointer-events: auto !important; transform: translateY(0) !important; }
      .font-scale-controls .font-scale-display { color: rgba(255,255,255,0.85) !important; font-size: calc(12px * var(--promptok-font-scale)) !important; min-width: 48px !important; text-align: center !important; }
      .font-scale-controls .font-decrease,
      .font-scale-controls .font-increase { color: rgba(255, 255, 255, 0.9) !important; background: rgba(255,255,255,0.06) !important; border: 1px solid rgba(255,255,255,0.12) !important; width: 28px !important; height: 28px !important; border-radius: 999px !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; transition: all 0.2s ease !important; }
      .font-scale-controls .font-decrease:hover,
      .font-scale-controls .font-increase:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.2) !important; }

      .promptok-chatgpt-minimize {
        color: rgba(255, 255, 255, 0.8) !important;
        background: rgba(196, 132, 252, 0.1) !important;
        border: 1px solid rgba(196, 132, 252, 0.2) !important;
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

      .promptok-chatgpt-minimize:hover {
        background: rgba(196, 132, 252, 0.2) !important;
        color: white !important;
        transform: translateY(-1px) scale(1.05) !important;
        box-shadow: 0 4px 16px rgba(196, 132, 252, 0.3) !important;
      }

      /* Close button: reduced by 15% from 34px */
      .promptok-chatgpt-close {
        color: rgba(255, 255, 255, 0.9) !important;
        background: rgba(196, 132, 252, 0.12) !important;
        border: 1px solid rgba(196, 132, 252, 0.24) !important;
        width: 29px !important;  /* 34px * 0.85 ≈ 28.9px */
        height: 29px !important; /* 34px * 0.85 ≈ 28.9px */
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        line-height: 0 !important; /* avoid baseline offset */
        font-size: 0 !important; /* remove inline text metrics */
        text-align: center !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        box-sizing: border-box !important;
        aspect-ratio: 1 / 1 !important; /* enforce square */
        flex: 0 0 29px !important; /* prevent stretching */
        min-width: 29px !important; min-height: 29px !important;
        max-width: 29px !important; max-height: 29px !important;
        align-self: center !important;
      }

      .promptok-chatgpt-close svg { display: block !important; width: 15px !important; height: 15px !important; pointer-events: none !important; margin: 0 !important; }

      .promptok-chatgpt-close:hover {
        background: rgba(196, 132, 252, 0.22) !important;
        color: white !important;
        transform: translateY(-1px) scale(1.05) !important;
        box-shadow: 0 4px 18px rgba(196, 132, 252, 0.35) !important;
      }

      .promptok-chatgpt-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 0 20px 20px !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(56, 189, 248, 0.4) transparent !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar {
        width: 6px !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-track {
        background: transparent !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-thumb {
        background: rgba(56, 189, 248, 0.4) !important;
        border-radius: 3px !important;
      }

      .promptok-chatgpt-content::-webkit-scrollbar-thumb:hover {
        background: rgba(56, 189, 248, 0.6) !important;
      }

      /* Backdrop for panel ambiance */
      .promptok-panel-backdrop {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(0, 0, 0, 0.55) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        z-index: 2147483646 !important;
        opacity: 0;
        animation: promptokBackdropIn 0.25s ease-out forwards;
      }
      @keyframes promptokBackdropIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .loading-spinner {
        width: 32px !important;
        height: 32px !important;
        border: 2px solid rgba(147, 51, 234, 0.1) !important;
        border-top: 2px solid #c084fc !important;
        border-right: 2px solid #d8b4fe !important;
        border-radius: 50% !important;
        animation: spinNeon 1s linear infinite !important;
        margin: 20px auto !important;
        box-shadow: 0 0 15px rgba(147, 51, 234, 0.3) !important;
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
        font-size: calc(14px * var(--promptok-font-scale)) !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.3) !important;
      }

      .prompt-text {
        background: rgba(6, 10, 18, 0.5) !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(56, 189, 248, 0.18) !important;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace !important;
        font-size: calc(12px * var(--promptok-font-scale)) !important;
        line-height: 1.4 !important;
        color: #e5f4ff !important;
        max-height: 100px !important;
        overflow-y: auto !important;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        text-shadow: 0 0 6px rgba(56, 189, 248, 0.25) !important;
      }

      .options-section h5 {
        margin: 0 0 8px 0 !important;
        color: white !important;
        font-size: calc(15px * var(--promptok-font-scale)) !important;
        font-weight: 600 !important;
        text-shadow: 0 0 10px rgba(56, 189, 248, 0.35) !important;
        letter-spacing: -0.025em !important;
      }

      .options-description {
        margin: 0 0 16px 0 !important;
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: calc(13px * var(--promptok-font-scale)) !important;
        line-height: 1.4 !important;
        text-shadow: 0 0 6px rgba(147, 51, 234, 0.2) !important;
      }

      .option-group {
        margin-bottom: 16px !important;
        padding: 14px !important;
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(56, 189, 248, 0.18) !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
      }

      .option-group h6 {
        margin: 0 0 8px 0 !important;
        color: white !important;
        font-size: calc(13px * var(--promptok-font-scale)) !important;
        font-weight: 600 !important;
        letter-spacing: -0.025em !important;
        text-shadow: 0 0 6px rgba(147, 51, 234, 0.3) !important;
      }

      .group-description {
        margin: 0 0 12px 0 !important;
        color: rgba(255, 255, 255, 0.6) !important;
        font-size: calc(12px * var(--promptok-font-scale)) !important;
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
        border: 1px solid rgba(56, 189, 248, 0.18) !important;
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
        background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.12), transparent) !important;
        transition: left 0.5s ease !important;
      }

      .option-item:hover::before {
        left: 100% !important;
      }

      .option-item:hover {
        border-color: rgba(56, 189, 248, 0.4) !important;
        background: rgba(56, 189, 248, 0.1) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 16px rgba(56, 189, 248, 0.2) !important;
      }

      .option-item input[type="checkbox"],
      .option-item input[type="radio"] {
        margin: 0 !important;
        cursor: pointer !important;
        width: 16px !important;
        height: 16px !important;
        accent-color: #22d3ee !important;
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
        font-size: calc(12px * var(--promptok-font-scale)) !important;
        letter-spacing: -0.025em !important;
        line-height: 1.2 !important;
        text-shadow: 0 0 6px rgba(56, 189, 248, 0.2) !important;
      }

      .option-short {
        display: block !important;
        font-size: calc(11px * var(--promptok-font-scale)) !important;
        color: rgba(255, 255, 255, 0.6) !important;
        line-height: 1.2 !important;
        text-shadow: 0 0 3px rgba(147, 51, 234, 0.1) !important;
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-label,
      .option-item input[type="radio"]:checked ~ .option-content .option-label {
        color: #22d3ee !important;
        font-weight: 700 !important;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.45) !important;
      }

      .option-item input[type="checkbox"]:checked ~ .option-content .option-short,
      .option-item input[type="radio"]:checked ~ .option-content .option-short {
        color: rgba(56, 189, 248, 0.85) !important;
        text-shadow: 0 0 4px rgba(56, 189, 248, 0.25) !important;
      }

      .promptok-chatgpt-actions {
        display: flex !important;
        gap: 10px !important;
        margin-top: 20px !important;
        align-items: center !important;
        padding-top: 16px !important;
        border-top: 1px solid rgba(147, 51, 234, 0.1) !important;
      }

      .promptok-chatgpt-actions button {
        flex: 1 !important;
        padding: 10px 16px !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        font-size: calc(13px * var(--promptok-font-scale)) !important;
        letter-spacing: -0.025em !important;
      }

      .promptok-chatgpt-actions button.primary {
        background: linear-gradient(135deg, #22d3ee 0%, #60a5fa 100%) !important;
        color: #0b1220 !important;
        border: 1px solid rgba(56, 189, 248, 0.35) !important;
        font-weight: 700 !important;
        box-shadow: 0 8px 20px rgba(56, 189, 248, 0.25) !important;
      }

      .promptok-chatgpt-actions button.primary:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 12px 30px rgba(56, 189, 248, 0.35) !important;
      }

      .promptok-chatgpt-actions button.copy-icon {
        width: 36px !important;
        height: 36px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(56, 189, 248, 0.25) !important;
        border-radius: 8px !important;
        color: #22d3ee !important;
        font-size: calc(12px * var(--promptok-font-scale)) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        backdrop-filter: blur(10px) !important;
      }

      .promptok-chatgpt-actions button.copy-icon:hover {
        background: rgba(56, 189, 248, 0.12) !important;
        color: #22d3ee !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 16px rgba(56, 189, 248, 0.25) !important;
        border-color: rgba(56, 189, 248, 0.35) !important;
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

      /* Resize handles */
      .promptok-resize-handle {
        position: absolute !important;
        background: transparent !important;
        z-index: 10 !important;
      }

      .promptok-resize-n {
        top: 0 !important;
        left: 10px !important;
        right: 10px !important;
        height: 4px !important;
        cursor: n-resize !important;
      }

      .promptok-resize-s {
        bottom: 0 !important;
        left: 10px !important;
        right: 10px !important;
        height: 4px !important;
        cursor: s-resize !important;
      }

      .promptok-resize-e {
        top: 10px !important;
        bottom: 10px !important;
        right: 0 !important;
        width: 4px !important;
        cursor: e-resize !important;
      }

      .promptok-resize-w {
        top: 10px !important;
        bottom: 10px !important;
        left: 0 !important;
        width: 4px !important;
        cursor: w-resize !important;
      }

      .promptok-resize-ne {
        top: 0 !important;
        right: 0 !important;
        width: 10px !important;
        height: 10px !important;
        cursor: ne-resize !important;
      }

      .promptok-resize-nw {
        top: 0 !important;
        left: 0 !important;
        width: 10px !important;
        height: 10px !important;
        cursor: nw-resize !important;
      }

      .promptok-resize-se {
        bottom: 0 !important;
        right: 0 !important;
        width: 10px !important;
        height: 10px !important;
        cursor: se-resize !important;
      }

      .promptok-resize-sw {
        bottom: 0 !important;
        left: 0 !important;
        width: 10px !important;
        height: 10px !important;
        cursor: sw-resize !important;
      }

      /* Visual feedback for resize handles on hover */
      .promptok-resize-handle:hover {
        background: rgba(196, 132, 252, 0.3) !important;
      }

      /* Corner handles get a slightly larger hover area */
      .promptok-resize-ne:hover,
      .promptok-resize-nw:hover,
      .promptok-resize-se:hover,
      .promptok-resize-sw:hover {
        background: rgba(196, 132, 252, 0.4) !important;
        border-radius: 2px !important;
      }
    `;
    panel.appendChild(style);
    return style;
  }

  // (Cleanup) Removed inline ambient overrides; relying on unified CSS theme

  makeResizable(panel) {
    const resizeHandles = panel.querySelectorAll('.promptok-resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startTop = 0;
    let startLeft = 0;

    // Minimum and maximum constraints
    const minWidth = 320;
    const minHeight = 400;
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;

    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        currentHandle = handle;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = panel.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;
        
        // Add visual feedback
        panel.style.setProperty('user-select', 'none', 'important');
        document.body.style.setProperty('user-select', 'none', 'important');
        document.body.style.setProperty('cursor', handle.style.cursor, 'important');
        
        // Prevent text selection during resize
        document.addEventListener('selectstart', preventDefault);
      });
    });

    const preventDefault = (e) => e.preventDefault();

    document.addEventListener('mousemove', (e) => {
      if (!isResizing || !currentHandle) return;
      
      e.preventDefault();
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const direction = currentHandle.dataset.direction;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newTop = startTop;
      let newLeft = startLeft;
      
      // Handle different resize directions
      switch (direction) {
        case 'n':
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          newTop = startTop + (startHeight - newHeight);
          break;
        case 's':
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          break;
        case 'e':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          break;
        case 'w':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          newLeft = startLeft + (startWidth - newWidth);
          break;
        case 'ne':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          newTop = startTop + (startHeight - newHeight);
          break;
        case 'nw':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          newTop = startTop + (startHeight - newHeight);
          newLeft = startLeft + (startWidth - newWidth);
          break;
        case 'se':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          break;
        case 'sw':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          newLeft = startLeft + (startWidth - newWidth);
          break;
      }
      
      // Apply the new dimensions and position
      panel.style.setProperty('width', `${newWidth}px`, 'important');
      panel.style.setProperty('height', `${newHeight}px`, 'important');
      panel.style.setProperty('top', `${newTop}px`, 'important');
      panel.style.setProperty('left', `${newLeft}px`, 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentHandle = null;
        
        // Save panel size after resize
        const rect = panel.getBoundingClientRect();
        this.savePanelSize(rect.width, rect.height, rect.top, rect.left);
        
        // Remove visual feedback
        panel.style.removeProperty('user-select');
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        
        // Re-enable text selection
        document.removeEventListener('selectstart', preventDefault);
      }
    });

    // Handle window resize to keep panel within bounds
    window.addEventListener('resize', () => {
      const rect = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let needsUpdate = false;
      let newLeft = rect.left;
      let newTop = rect.top;
      let newWidth = rect.width;
      let newHeight = rect.height;
      
      // Keep panel within viewport bounds
      if (rect.right > viewportWidth) {
        newLeft = Math.max(0, viewportWidth - rect.width);
        needsUpdate = true;
      }
      if (rect.bottom > viewportHeight) {
        newTop = Math.max(0, viewportHeight - rect.height);
        needsUpdate = true;
      }
      if (rect.left < 0) {
        newLeft = 0;
        needsUpdate = true;
      }
      if (rect.top < 0) {
        newTop = 0;
        needsUpdate = true;
      }
      
      // Ensure panel doesn't exceed viewport size
      if (rect.width > viewportWidth * 0.9) {
        newWidth = viewportWidth * 0.9;
        needsUpdate = true;
      }
      if (rect.height > viewportHeight * 0.9) {
        newHeight = viewportHeight * 0.9;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        panel.style.setProperty('left', `${newLeft}px`, 'important');
        panel.style.setProperty('top', `${newTop}px`, 'important');
        panel.style.setProperty('width', `${newWidth}px`, 'important');
        panel.style.setProperty('height', `${newHeight}px`, 'important');
        panel.style.setProperty('right', 'auto', 'important');
      }
    });
  }

  setupChatGPTEventListeners(panel, parsedData) {
    // Minimize button
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    minimizeBtn.addEventListener('click', () => this.minimizeChatGPTOverlay(panel));

    // Auto-minimize when clicking outside the panel
    const outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    // Add slight delay to prevent immediate triggering
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);

    // Font scale controls
    const controlsWrap = panel.querySelector('.font-scale-controls');
    const triggerBtn = panel.querySelector('.font-trigger');
    const decBtn = panel.querySelector('.font-decrease');
    const incBtn = panel.querySelector('.font-increase');
    const disp = panel.querySelector('.font-scale-display');
    if (disp) disp.textContent = `${Math.round(this.fontScale * 100)}%`;
    if (triggerBtn && controlsWrap) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        controlsWrap.classList.toggle('open');
      });
      // Close when clicking outside the panel
      document.addEventListener('click', (e) => {
        try {
          if (!panel.contains(e.target)) controlsWrap.classList.remove('open');
        } catch (_) {}
      }, { once: true });
      // Smooth hover: open immediately on enter, hide after a short delay on leave
      controlsWrap.addEventListener('mouseenter', () => {
        try { if (controlsWrap._hideTimer) { clearTimeout(controlsWrap._hideTimer); controlsWrap._hideTimer = null; } } catch (_) {}
        controlsWrap.classList.add('open');
      });
      controlsWrap.addEventListener('mouseleave', () => {
        try { if (controlsWrap._hideTimer) clearTimeout(controlsWrap._hideTimer); } catch (_) {}
        controlsWrap._hideTimer = setTimeout(() => controlsWrap.classList.remove('open'), 150);
      });
      controlsWrap.addEventListener('focusout', () => {
        try {
          if (!controlsWrap.contains(document.activeElement)) controlsWrap.classList.remove('open');
        } catch (_) {}
      });
    }
    if (decBtn) decBtn.addEventListener('click', () => this.adjustFontScale(-0.1));
    if (incBtn) incBtn.addEventListener('click', () => this.adjustFontScale(0.1));

    // Apply prompt (base + selected options)
    const applyBtn = panel.querySelector('#promptok-chatgpt-apply');
    applyBtn.addEventListener('click', async () => {
      this.debugLog('Apply button clicked');
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.debugLog('Final prompt built:', finalPrompt);
      await this.applyPromptToInput(finalPrompt);
      // Best-effort: finalize session with final prompt
      this.finalizeSession(finalPrompt).catch(() => {});
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

    // Minimize on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  updateChatGPTButtonText(panel) {
    const applyBtn = panel.querySelector('#promptok-chatgpt-apply');
    // Always show a simple label regardless of selected options
    applyBtn.textContent = 'Apply';
  }

  minimizeChatGPTOverlay(panel) {
    this.debugLog('Minimizing ChatGPT overlay, preserving data');
    this.debugLog('Enhancement data before minimize:', !!this.currentEnhancementData);

    this.isMinimized = true;
    panel.style.opacity = '0';

    setTimeout(() => {
      panel.remove();
      try { document.querySelector('.promptok-panel-backdrop')?.remove(); } catch (_) {}
      this.showMinimizedButton();
      // Persist session after minimizing
      this.saveSessionState().catch(() => {});
      this.debugLog('ChatGPT overlay minimized, data preserved:', !!this.currentEnhancementData);
    }, 400);
  }

  closeErrorOverlay(panel) {
    if (panel && panel.parentNode) {
      panel.remove();
    }
    try { document.querySelector('.promptok-panel-backdrop')?.remove(); } catch (_) {}
  }

  // Removed auto-fade for errors to standardize minimize/close behavior

  showSuccessChatGPT(message) {
    const panel = document.querySelector('.promptok-chatgpt-panel');
    if (!panel) return;

    const statusEl = panel.querySelector('.promptok-chatgpt-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'promptok-chatgpt-status success';
    }
  }

  // Global wrappers to normalize error UI across all sites
  showAuthError() {
    // Always use ChatGPT-style auth error panel globally
    return this.showAuthErrorChatGPT();
  }

  showRateLimitError() {
    // Always use ChatGPT-style rate limit panel globally
    return this.showRateLimitErrorChatGPT();
  }

  showError(message) {
    // Lightweight center-top banner with quick slide down, wait ~2s, then slide up + fade out
    // Keep specialized flows (auth/limit) using dedicated panels via showAuthError()/showRateLimitError()
    const text = typeof message === 'string' && message ? message : 'Something went wrong.';
    return this.showNotification('error', text, 2000, { position: 'top-center', animation: 'slide' });
  }

  showErrorChatGPT(message) {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel promptok-panel-global';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>⚠️ Enhancement Error</h4>
        <div class="header-controls">
          <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
          <button class="promptok-chatgpt-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <p>${message}</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-close-error" class="primary">Close</button>
        </div>
      </div>
      
      <!-- Resize handles -->
      <div class="promptok-resize-handle promptok-resize-n" data-direction="n"></div>
      <div class="promptok-resize-handle promptok-resize-s" data-direction="s"></div>
      <div class="promptok-resize-handle promptok-resize-e" data-direction="e"></div>
      <div class="promptok-resize-handle promptok-resize-w" data-direction="w"></div>
      <div class="promptok-resize-handle promptok-resize-ne" data-direction="ne"></div>
      <div class="promptok-resize-handle promptok-resize-nw" data-direction="nw"></div>
      <div class="promptok-resize-handle promptok-resize-se" data-direction="se"></div>
      <div class="promptok-resize-handle promptok-resize-sw" data-direction="sw"></div>
    `;

    this.addChatGPTStyles(panel);
    // Apply global panel theme styling
    if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelGlobalStyles === 'function') {
      window.PromptOK_UI.addChatPanelGlobalStyles(panel);
    } else if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelPerplexityStyles === 'function') {
      window.PromptOK_UI.addChatPanelPerplexityStyles(panel);
    }
    document.body.appendChild(panel);

    // Add resize functionality
    this.makeResizable(panel);

    // Add minimize/close listeners (standardized to minimize on outside/ESC)
    const closeBtn = panel.querySelector('.promptok-chatgpt-close');
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    const closeErrorBtn = panel.querySelector('#promptok-chatgpt-close-error');

    const minimizeHandler = () => this.minimizeChatGPTOverlay(panel);
    const closeHandler = () => this.closeErrorOverlay(panel);
    if (minimizeBtn) minimizeBtn.addEventListener('click', minimizeHandler);
    if (closeErrorBtn) closeErrorBtn.addEventListener('click', closeHandler);
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);

    // Minimize when clicking outside the panel (standardized)
    const outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  showAuthErrorChatGPT() {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel promptok-panel-global';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>🔒 Login Required</h4>
        <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <h3>Please log in to use the enhancement feature</h3>
          <p>You need to be signed in to access AI-powered prompt enhancement.</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-login" class="primary">Log In</button>
          <button id="promptok-chatgpt-minimize-auth" class="secondary">Minimize</button>
        </div>
      </div>
      
      <!-- Resize handles -->
      <div class="promptok-resize-handle promptok-resize-n" data-direction="n"></div>
      <div class="promptok-resize-handle promptok-resize-s" data-direction="s"></div>
      <div class="promptok-resize-handle promptok-resize-e" data-direction="e"></div>
      <div class="promptok-resize-handle promptok-resize-w" data-direction="w"></div>
      <div class="promptok-resize-handle promptok-resize-ne" data-direction="ne"></div>
      <div class="promptok-resize-handle promptok-resize-nw" data-direction="nw"></div>
      <div class="promptok-resize-handle promptok-resize-se" data-direction="se"></div>
      <div class="promptok-resize-handle promptok-resize-sw" data-direction="sw"></div>
    `;

    this.addChatGPTStyles(panel);
    // Apply Perplexity styling if available
    if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelPerplexityStyles === 'function') {
      window.PromptOK_UI.addChatPanelPerplexityStyles(panel);
    }
    document.body.appendChild(panel);

    // Add resize functionality
    this.makeResizable(panel);

    // Add event listeners
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    const loginBtn = panel.querySelector('#promptok-chatgpt-login');
    const minimizeAuthBtn = panel.querySelector('#promptok-chatgpt-minimize-auth');

    const minimizeHandler = () => this.minimizeChatGPTOverlay(panel);
    minimizeBtn.addEventListener('click', minimizeHandler);
    minimizeAuthBtn.addEventListener('click', minimizeHandler);

    // Auto-minimize when clicking outside the panel
    const outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);

    loginBtn.addEventListener('click', () => {
      // Redirect to login page
      window.open('https://promptok.app/auth/start', '_blank');
      closeHandler();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler, { once: true });
  }

  showRateLimitErrorChatGPT() {
    this.removeExistingOverlay();

    const panel = document.createElement('div');
    panel.className = 'promptok-chatgpt-panel promptok-panel-global';
    panel.innerHTML = `
      <div class="promptok-chatgpt-header">
        <h4>⚡ Enhancement Limit Reached</h4>
        <button class="promptok-chatgpt-minimize" aria-label="Minimize">−</button>
      </div>
      <div class="promptok-chatgpt-content">
        <div class="error-message">
          <h3>Enhancement limit reached</h3>
          <p>You've reached your current plan's enhancement limit. Upgrade to continue using AI-powered enhancements.</p>
        </div>
        <div class="promptok-chatgpt-actions">
          <button id="promptok-chatgpt-upgrade" class="primary">Upgrade Subscription</button>
          <button id="promptok-chatgpt-minimize-limit" class="secondary">Minimize</button>
        </div>
      </div>
      
      <!-- Resize handles -->
      <div class="promptok-resize-handle promptok-resize-n" data-direction="n"></div>
      <div class="promptok-resize-handle promptok-resize-s" data-direction="s"></div>
      <div class="promptok-resize-handle promptok-resize-e" data-direction="e"></div>
      <div class="promptok-resize-handle promptok-resize-w" data-direction="w"></div>
      <div class="promptok-resize-handle promptok-resize-ne" data-direction="ne"></div>
      <div class="promptok-resize-handle promptok-resize-nw" data-direction="nw"></div>
      <div class="promptok-resize-handle promptok-resize-se" data-direction="se"></div>
      <div class="promptok-resize-handle promptok-resize-sw" data-direction="sw"></div>
    `;

    this.addChatGPTStyles(panel);
    // Apply Perplexity styling if available
    if (window.PromptOK_UI && typeof window.PromptOK_UI.addChatPanelPerplexityStyles === 'function') {
      window.PromptOK_UI.addChatPanelPerplexityStyles(panel);
    }
    document.body.appendChild(panel);

    // Add resize functionality
    this.makeResizable(panel);

    // Add event listeners
    const minimizeBtn = panel.querySelector('.promptok-chatgpt-minimize');
    const upgradeBtn = panel.querySelector('#promptok-chatgpt-upgrade');
    const minimizeLimitBtn = panel.querySelector('#promptok-chatgpt-minimize-limit');

    const minimizeHandler = () => this.minimizeChatGPTOverlay(panel);
    minimizeBtn.addEventListener('click', minimizeHandler);
    minimizeLimitBtn.addEventListener('click', minimizeHandler);

    // Auto-minimize when clicking outside the panel
    const outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) {
        this.minimizeChatGPTOverlay(panel);
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);

    upgradeBtn.addEventListener('click', () => {
      // Redirect to purchase page
      window.open('https://promptok.app/dashboard', '_blank');
      closeHandler();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.minimizeChatGPTOverlay(panel);
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

    // Font scale controls
    const controlsWrap = overlay.querySelector('.font-scale-controls');
    const triggerBtn = overlay.querySelector('.font-trigger');
    const decBtn = overlay.querySelector('.font-decrease');
    const incBtn = overlay.querySelector('.font-increase');
    const disp = overlay.querySelector('.font-scale-display');
    if (disp) disp.textContent = `${Math.round(this.fontScale * 100)}%`;
    if (triggerBtn && controlsWrap) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        controlsWrap.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        try {
          if (!overlay.contains(e.target)) controlsWrap.classList.remove('open');
        } catch (_) {}
      }, { once: true });
      // Smooth hover behavior
      controlsWrap.addEventListener('mouseenter', () => {
        try { if (controlsWrap._hideTimer) { clearTimeout(controlsWrap._hideTimer); controlsWrap._hideTimer = null; } } catch (_) {}
        controlsWrap.classList.add('open');
      });
      controlsWrap.addEventListener('mouseleave', () => {
        try { if (controlsWrap._hideTimer) clearTimeout(controlsWrap._hideTimer); } catch (_) {}
        controlsWrap._hideTimer = setTimeout(() => controlsWrap.classList.remove('open'), 150);
      });
    }
    if (decBtn) decBtn.addEventListener('click', () => this.adjustFontScale(-0.1));
    if (incBtn) incBtn.addEventListener('click', () => this.adjustFontScale(0.1));

    // Apply prompt (base + selected options)
    const applyBtn = overlay.querySelector('#promptok-apply');
    applyBtn.addEventListener('click', async () => {
      this.debugLog('Apply button clicked');
      const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
      this.debugLog('Final prompt built:', finalPrompt);
      await this.applyPromptToInput(finalPrompt);
      // Best-effort: finalize session with final prompt
      this.finalizeSession(finalPrompt).catch(() => {});
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
          this.minimizeChatGPTOverlay(panel);
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
    // Always show a simple label regardless of selected options
    applyBtn.textContent = 'Apply';
  }

  async applyPromptToInput(finalPrompt) {
    this.debugLog('Starting applyPromptToInput');
    const input = this.currentInput || await this.detect();
    if (!input) {
      this.showError('Could not find input field to apply prompt');
      return;
    }
    
    const safeTag = (input && input.tagName) ? input.tagName : '(unknown)';
    const hasAttrFn = input && typeof input.hasAttribute === 'function';
    const isLex = hasAttrFn ? input.hasAttribute('data-lexical-editor') : false;
    this.debugLog('Input detected:', safeTag, 'isLexical:', isLex);
    this.debugLog('Input value before:', this.getInputValue(input));
    
    input.focus();
    
    try {
      const success = this.setInputValue(input, finalPrompt);
      
      // Verify and show result
      setTimeout(() => {
        this.verifyAndShowResult(input, finalPrompt, success);
        if (!success) {
          // Attempt to mark session as failed apply
          this.finalizeSession(finalPrompt, 'failed').catch(() => {});
        }
      }, 200);
      
    } catch (error) {
      console.error('Error applying prompt:', error);
      this.showError('Failed to apply prompt. Please copy and paste manually.');
    }
  }

  setInputValue(input, text) {
    const isLexical = (input && typeof input.hasAttribute === 'function') && input.hasAttribute('data-lexical-editor');
    
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
    
    // Mark last enhanced value when applied (used for reload indicator)
    if (isApplied) {
      try {
        input._promptokLastEnhancedValue = expectedText;
        const btn = this.floatingButtons.get(input);
        if (btn) this.updateReloadIndicator(btn, input);
      } catch(_) { /* ignore */ }
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
    
    const isLexical = (input && typeof input.hasAttribute === 'function') && input.hasAttribute('data-lexical-editor');
    
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
    // Render as a lightweight notification that fades automatically (success style)
    this.showNotification('success', message || 'Done!', 3000);
  }

  // Toast notification system (success/error/info) with auto-dismiss and smooth animations
  showNotification(type = 'info', message = '', duration = 3000, opts = {}) {
    try {
      const position = opts && typeof opts.position === 'string' ? opts.position : 'top-right';
      const animation = opts && typeof opts.animation === 'string' ? opts.animation : 'fade';
      const container = this.getOrCreateToastContainer(position);
      const toast = document.createElement('div');
      toast.className = 'promptok-toast';

      // Base styles (inline with !important to beat host page styles)
      const s = (p, v) => toast.style.setProperty(p, v, 'important');
      s('display', 'flex');
      s('gap', '10px');
      s('align-items', 'flex-start');
      s('position', 'relative');
      s('padding', '12px 16px');
      s('margin', '7px 0');
      s('border-radius', '14px');
      s('backdrop-filter', 'blur(14px)');
      s('-webkit-backdrop-filter', 'blur(14px)');
      s('box-shadow', '0 14px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset');
      s('border', '1px solid rgba(255,255,255,0.12)');
      s('color', '#fff');
      s('font', '13px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial');
      s('max-width', '504px');
      s('pointer-events', 'none'); // non-interactive (no close button)
      s('opacity', '0');
      // Initial transform depends on animation
      if (animation === 'slide') {
        s('transform', 'translateY(-12px)');
        s('transition', 'opacity .16s ease, transform .16s ease');
      } else {
        s('transform', 'translateY(8px)');
        s('transition', 'opacity .18s ease, transform .18s ease');
      }

      // Color accents per type
      let accent = '0, 112, 243'; // blue
      if (type === 'success') accent = '16, 185, 129'; // green
      if (type === 'error') accent = '239, 68, 68'; // red-500 base
      // Base background
      s('background', `linear-gradient(180deg, rgba(16,16,20,0.94), rgba(10,10,12,0.94))`);
      s('--accent', `rgb(${accent})`);
      s('border-color', 'rgba(255,255,255,0.12)');
      // Error-specific full red styling (cylindrical pill)
      if (type === 'error') {
        s('background', 'linear-gradient(180deg, rgba(239,68,68,0.97), rgba(220,38,38,0.97))');
        s('box-shadow', '0 16px 36px rgba(220,38,38,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset');
        s('border', '1px solid rgba(255,255,255,0.16)');
        s('border-radius', '999px');
        s('padding', '14px 20px');
      }

      // Left accent bar (skip for error to preserve clean pill look)
      const bar = document.createElement('div');
      const bs = (p, v) => bar.style.setProperty(p, v, 'important');
      bs('width', '4px');
      bs('border-radius', '4px');
      bs('background', `var(--accent)`);
      bs('box-shadow', '0 0 10px rgba(255,255,255,0.10) inset, 0 0 12px var(--accent)');

      // Icon + text
      const content = document.createElement('div');
      const cs = (p, v) => content.style.setProperty(p, v, 'important');
      cs('display', 'flex'); cs('gap', '8px'); cs('align-items', 'flex-start');

      const icon = document.createElement('div');
      const is = (p, v) => icon.style.setProperty(p, v, 'important');
      is('width', '18px'); is('height', '18px');
      is('margin-top', '1px');
      is('color', 'var(--accent)');
      icon.innerHTML = type === 'success'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 7L9 18l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 16h-1v-4h-1m1-4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg>';

      const text = document.createElement('div');
      const ts = (p, v) => text.style.setProperty(p, v, 'important');
      ts('white-space', 'pre-wrap'); ts('word-break', 'break-word'); ts('opacity', '.98');
      ts('letter-spacing', '0.2px');
      if (type === 'error') { ts('font-weight', '600'); ts('font-family', 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial'); }
      text.textContent = message;

      // Append icon only for non-error types
      if (type !== 'error') content.appendChild(icon);
      content.appendChild(text);
      // Skip left bar for error (clean pill look)
      if (type !== 'error') toast.appendChild(bar);
      toast.appendChild(content);

      // Insert and animate in
      container.appendChild(toast);
      requestAnimationFrame(() => {
        s('opacity', '1');
        s('transform', 'translateY(0)');
      });

      let hideTimer = null;
      let remaining = Math.max(1500, Number(duration) || 3000);
      let startTime = null;
      const removeToast = () => {
        try { if (hideTimer) clearTimeout(hideTimer); } catch(_) {}
        // Smooth fade-out
        s('opacity', '0');
        if (animation === 'slide') {
          s('transform', 'translateY(-12px)');
        } else {
          s('transform', 'translateY(6px)');
        }
        setTimeout(() => { try { toast.remove(); } catch(_){} }, 220);
        // If manual close and container becomes empty, remove container
        setTimeout(() => {
          if (container && !container.children.length) {
            try { container.remove(); } catch(_){}
          }
        }, 260);
        // Cleanup listeners
        try {
          document.removeEventListener('visibilitychange', onVisibility);
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
        } catch(_) {}
      };

      const startTimer = () => {
        try { if (hideTimer) clearTimeout(hideTimer); } catch(_) {}
        startTime = Date.now();
        hideTimer = setTimeout(() => removeToast(), remaining);
      };
      const pauseTimer = () => {
        if (hideTimer) {
          try { clearTimeout(hideTimer); } catch(_) {}
          hideTimer = null;
          if (startTime) {
            const elapsed = Date.now() - startTime;
            remaining = Math.max(0, remaining - elapsed);
          }
        }
      };
      const onVisibility = () => {
        if (document.hidden) {
          pauseTimer();
        } else {
          if (remaining > 0) startTimer(); else removeToast();
        }
      };
      const onBlur = () => { pauseTimer(); };
      const onFocus = () => { if (!document.hidden) { if (remaining > 0) startTimer(); else removeToast(); } };
      try {
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
      } catch(_) {}

      // Auto-dismiss with visibility-aware timer
      startTimer();

      return toast;
    } catch (_) {
      // As a last resort, fallback to alert (should rarely happen)
      try { console.warn('[PromptOK] Notification failed, falling back to alert'); } catch(_){}
      try { alert(message); } catch(_){}
    }
  }

  getOrCreateToastContainer(position = 'top-right') {
    // Separate containers for positions to avoid mixing layouts
    let container = document.querySelector(`.promptok-toast-container[data-position="${position}"]`);
    if (container) return container;
    container = document.createElement('div');
    container.className = 'promptok-toast-container';
    container.setAttribute('data-position', position);
    const s = (p, v) => container.style.setProperty(p, v, 'important');
    s('position', 'fixed');
    s('z-index', '2147483647');
    s('display', 'flex');
    s('flex-direction', 'column');
    s('gap', '0');
    s('pointer-events', 'none'); // allow page clicks through gaps

    // Position presets
    if (position === 'top-center') {
      s('top', '16px');
      s('left', '50%');
      s('right', 'auto');
      s('transform', 'translateX(-50%)');
      s('align-items', 'center');
    } else {
      // default top-right
      s('top', '14px');
      s('right', '14px');
      s('left', 'auto');
    }

    // Appending to body
    document.body.appendChild(container);
    return container;
  }

  // Enhancement options router: use side panel globally (Perplexity-themed panel)
  showEnhancementOptions(parsedData) {
    return this.showEnhancementOptionsChatGPT(parsedData);
  }

  // Removed non-ChatGPT overlay; using unified side panel for all sites

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
    minimizedBtn.innerHTML = `✨<span class="minimized-count"></span>`;
    minimizedBtn.title = `PromptOK enhancer (${this.selectedOptions.size} options selected)`;
    minimizedBtn.setAttribute('role', 'button');
    minimizedBtn.setAttribute('aria-label', 'Open PromptOK enhancement panel');
    // Insert into document body early so styles apply while we compute position
    document.body.appendChild(minimizedBtn);
    // Add styles
    this.addMinimizedButtonStyles(minimizedBtn);
    // Initialize badge count visibility/value
    this.updateMinimizedButtonCount();
    
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

  addMinimizedButtonStyles(minimizedBtn) {
    try {
      // Base button styles
      minimizedBtn.style.width = '36px';
      minimizedBtn.style.height = '36px';
      minimizedBtn.style.borderRadius = '999px';
      minimizedBtn.style.background = 'rgba(147, 51, 234, 0.15)';
      minimizedBtn.style.border = '1px solid rgba(196, 132, 252, 0.35)';
      minimizedBtn.style.backdropFilter = 'blur(10px)';
      minimizedBtn.style.webkitBackdropFilter = 'blur(10px)';
      minimizedBtn.style.display = 'flex';
      minimizedBtn.style.alignItems = 'center';
      minimizedBtn.style.justifyContent = 'center';
      minimizedBtn.style.color = '#e9d5ff';
      minimizedBtn.style.fontSize = '18px';
      minimizedBtn.style.boxShadow = '0 8px 24px rgba(147, 51, 234, 0.3)';
      minimizedBtn.style.cursor = 'pointer';
      minimizedBtn.style.userSelect = 'none';
      minimizedBtn.style.transition = 'transform .15s ease, box-shadow .15s ease, background .15s ease';
      minimizedBtn.addEventListener('mouseenter', () => {
        minimizedBtn.style.transform = 'translateY(-1px) scale(1.03)';
        minimizedBtn.style.boxShadow = '0 10px 28px rgba(147, 51, 234, 0.4)';
        minimizedBtn.style.background = 'rgba(147, 51, 234, 0.22)';
      });
      minimizedBtn.addEventListener('mouseleave', () => {
        minimizedBtn.style.transform = 'none';
        minimizedBtn.style.boxShadow = '0 8px 24px rgba(147, 51, 234, 0.3)';
        minimizedBtn.style.background = 'rgba(147, 51, 234, 0.15)';
      });

      // Badge styles via CSS once
      const styleId = 'promptok-minimized-button-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .${this.minimizedButtonClass} {
            z-index: 9999;
          }
          .${this.minimizedButtonClass} .minimized-count {
            position: absolute;
            top: -6px;
            right: -6px;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            background: #8b5cf6;
            color: white;
            display: none;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid rgba(255,255,255,0.5);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `;
        document.head.appendChild(style);
      }

      // Ensure the count element exists
      if (!minimizedBtn.querySelector('.minimized-count')) {
        const count = document.createElement('span');
        count.className = 'minimized-count';
        minimizedBtn.appendChild(count);
      }
    } catch (err) {
      this.debugLog('Failed to apply minimized button styles:', err);
    }
  }

  positionMinimizedButton(input, minimizedBtn, options = {}) {
    if (!input || !minimizedBtn) return;
    
    try {
      const { siblingButton } = options;
      const inputRect = input.getBoundingClientRect();
      
      // Find the enhance button for this input
      const inputId = input.getAttribute('data-promptok-id');
      const enhanceBtn = siblingButton || document.querySelector(`.${this.buttonClass}[data-input-id="${inputId}"]`);
      
      if (enhanceBtn) {
        // Position next to the enhance button
        const btnRect = enhanceBtn.getBoundingClientRect();
        minimizedBtn.style.position = 'fixed';
        minimizedBtn.style.left = `${btnRect.right + 8}px`;
        minimizedBtn.style.top = `${btnRect.top}px`;
        minimizedBtn.style.zIndex = '9999';
      } else {
        // Fallback: position near the input field
        minimizedBtn.style.position = 'fixed';
        minimizedBtn.style.left = `${inputRect.right - 40}px`;
        minimizedBtn.style.top = `${inputRect.top - 40}px`;
        minimizedBtn.style.zIndex = '9999';
      }
    } catch (error) {
      this.debugLog('Error positioning minimized button:', error);
    }
  }

  async restoreOverlay() {
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
    try {
      if (window.PromptOK_UI && typeof window.PromptOK_UI.removeOverlay === 'function') {
        return window.PromptOK_UI.removeOverlay();
      }
    } catch (_) { /* ignore */ }
    const existing = document.querySelector(`.${this.overlayClass}`);
    if (existing) {
      try { existing.style.opacity = '0'; } catch (_) {}
      setTimeout(() => { try { existing.remove(); } catch (_) {} }, 400);
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
        font-size: calc(14px * var(--promptok-font-scale, 1));
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
        font-size: calc(14px * var(--promptok-font-scale, 1));
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

  addEnhancedStyles(overlay) {
    const style = document.createElement('style');
    style.textContent = `
      .promptok-card.enhanced {
        background: linear-gradient(180deg, rgba(0, 112, 243, 0.12), rgba(0, 112, 243, 0.06));
        border: 1px solid rgba(0, 112, 243, 0.25);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        padding: 18px;
        color: #ffffff;
        /* Base font scaling so all descendants inherit, ensures reload reflects saved zoom */
        font-size: calc(14px * var(--promptok-font-scale, 1));
      }
      .promptok-card.enhanced .promptok-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(147, 51, 234, 0.05);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(147, 51, 234, 0.15);
        padding: 20px 24px 16px;
        margin: 0;
      }

      .promptok-card.enhanced .promptok-header h4 {
        color: white;
        text-shadow: 0 0 20px rgba(0, 112, 243, 0.4);
        margin: 0;
        font-size: calc(22px * var(--promptok-font-scale, 1));
        font-weight: 700;
        letter-spacing: -0.03em;
        background: linear-gradient(135deg, #a855f7 0%, #ffffff 50%, #c084fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .header-controls {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      /* Font scale controls (compact trigger + hover popover) */
      .font-scale-controls { position: relative; display: inline-flex; overflow: visible; }
      .font-scale-controls .font-trigger {
        color: rgba(255,255,255,0.9);
        width: 36px; height: 36px; border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s ease;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      }
      .font-scale-controls .font-trigger:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
      .font-scale-controls .font-icon { display: block; opacity: 0.9; }
      .font-scale-controls .font-popover {
        position: absolute; top: 36px; right: 0;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 10px;
        background: linear-gradient(135deg, rgba(196,132,252,0.12), rgba(147,51,234,0.1));
        border: 1px solid rgba(196,132,252,0.25);
        border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        opacity: 0; pointer-events: none; transform: translateY(-2px);
        transition: opacity .15s ease, transform .15s ease; z-index: 2;
      }
      .font-scale-controls:hover .font-popover,
      .font-scale-controls.open .font-popover { opacity: 1; pointer-events: auto; transform: translateY(0); }
      .font-scale-controls .font-scale-display { color: rgba(255,255,255,0.85); font-size: calc(12px * var(--promptok-font-scale, 1)); min-width: 48px; text-align: center; }
      .font-scale-controls .font-decrease,
      .font-scale-controls .font-increase {
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        width: 28px; height: 28px; border-radius: 999px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s ease;
      }
      .font-scale-controls .font-decrease:hover,
      .font-scale-controls .font-increase:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }

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
        font-size: calc(15px * var(--promptok-font-scale, 1));
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
        font-size: calc(13px * var(--promptok-font-scale, 1));
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
        font-size: calc(16px * var(--promptok-font-scale, 1));
        font-weight: 600;
        text-shadow: 0 0 15px rgba(0, 112, 243, 0.4);
        letter-spacing: -0.025em;
      }

      .options-description {
        margin: 0 0 20px 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: calc(14px * var(--promptok-font-scale, 1));
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
        font-size: calc(14px * var(--promptok-font-scale, 1));
        font-weight: 600;
        letter-spacing: -0.025em;
        text-shadow: 0 0 8px rgba(0, 112, 243, 0.3);
      }

      .group-description {
        margin: 0 0 14px 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: calc(13px * var(--promptok-font-scale, 1));
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
        font-size: calc(13px * var(--promptok-font-scale, 1));
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
