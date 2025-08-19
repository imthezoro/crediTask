class AdvancedPromptEnhancer {
  constructor() {
    this.currentEnhancementData = null;
    this.selectedOptions = new Set();
    this.apiEndpoint = 'https://coqwcumwpixmrjqnmhkv.supabase.co/functions/v1/enhance-prompt';
    this.buttonClass = 'promptok-enhance-button';
    this.overlayClass = 'promptok-overlay';
    this.isMinimized = false;
    this.minimizedButtonClass = 'promptok-minimized-button';
    this.sessionStorageKey = 'promptok.session';
    
    // Debug mode - set to true for detailed logging
    this.debug = true;
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

  // Test function to debug apply functionality
  testApply() {
    this.debugLog('Testing apply functionality...');
    const testPrompt = "This is a test prompt to verify the apply button works.";
    this.applyPromptToInput(testPrompt);
  }

  detect() {
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="type" i]',
      'textarea[placeholder*="enter" i]',
      '[contenteditable="true"]',
      'input[type="text"][placeholder*="prompt" i]',
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]'
    ];
    
    // Try each selector individually for better debugging
    let input = null;
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found && this.isValidInput(found)) {
        input = found;
        console.log('Found input with selector:', selector, input);
        break;
      }
    }
    
    if (input && !this.hasEnhanceButton(input)) {
      this.addEnhanceButton(input);
    }
    return input;
  }

  isValidInput(element) {
    // Check if element is visible and interactable
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           !element.disabled &&
           element.offsetParent !== null;
  }

  hasEnhanceButton(input) {
    return input.parentNode?.querySelector(`.${this.buttonClass}`) !== null;
  }

  addEnhanceButton(input) {
    const button = this.createEnhanceButton();
    this.positionButton(input, button);
    this.attachButtonEvents(button);
  }

  createEnhanceButton() {
    const button = document.createElement('button');
    button.className = this.buttonClass;
    button.innerHTML = '✨';
    button.title = 'Enhance prompt with AI';
    button.setAttribute('aria-label', 'Enhance prompt with AI');
    this.applyButtonStyles(button);
    return button;
  }

  applyButtonStyles(button) {
    Object.assign(button.style, {
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'rgba(0,0,0,0.1)',
      border: 'none',
      fontSize: '16px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      zIndex: '1000',
      transition: 'all 0.2s ease'
    });
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(0,0,0,0.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(0,0,0,0.1)';
    });
  }

  positionButton(input, button) {
    // Ensure input has relative positioning
    if (getComputedStyle(input).position === 'static') {
      input.style.position = 'relative';
    }
    input.style.paddingRight = '30px';
    
    // Insert button appropriately
    if (input.nextSibling) {
      input.parentNode.insertBefore(button, input.nextSibling);
    } else {
      input.parentNode.appendChild(button);
    }
  }

  attachButtonEvents(button) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.startEnhancement();
    });
  }

  async startEnhancement() {
    const input = this.detect();
    if (!input) return;
    
    const prompt = input.value || input.textContent || '';
    if (!prompt.trim()) {
      this.showError('Please enter a prompt first');
      return;
    }

    // Show loading overlay
    this.showLoadingOverlay();
    
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
      console.error('Enhancement error:', error);
      this.showError('Failed to enhance prompt. Please try again.');
    }
  }

  async getEnhancementData(prompt) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in to use prompt enhancement.');
    }

    const response = await this.makeApiRequest(prompt, accessToken);
    const data = await this.handleApiResponse(response);
    return {
      rawResponse: data.enhancedPrompt,
      structuredData: data.structuredData
    };
  }

  async getAccessToken() {
    // Try primary storage key first
    let accessToken = await this.getStorageItem('access_token');
    
    // Fallback to alternative storage format
    if (!accessToken) {
      const authData = await this.getStorageItem('supabase.auth.token');
      accessToken = authData?.access_token;
    }
    
    return accessToken;
  }

  async makeApiRequest(prompt, accessToken) {
    return fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ prompt })
    });
  }

  async handleApiResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: Enhancement failed`);
    }
    return response.json();
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

  showLoadingOverlay() {
    this.removeExistingOverlay();
    
    const overlay = document.createElement('div');
    overlay.className = 'promptok-overlay';
    overlay.innerHTML = `
      <div class="promptok-card">
        <div class="promptok-loading">
          <div class="loading-spinner"></div>
          <h4>Enhancing your prompt...</h4>
          <p>AI is analyzing and improving your prompt</p>
        </div>
      </div>
    `;
    
    this.addOverlayStyles(overlay);
    document.body.appendChild(overlay);
  }

  showEnhancementOptions(parsedData) {
    this.removeExistingOverlay();
    
    const overlay = document.createElement('div');
    overlay.className = 'promptok-overlay';
    
    // Build the options UI
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
    
    // Add event listeners
    this.setupEnhancedEventListeners(overlay, parsedData);
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
    
    // Close when clicking outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeOverlay();
      }
    });
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
    const input = this.detect();
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
    const overlay = document.querySelector('.promptok-overlay');
    if (!overlay) return;
    
    const statusEl = overlay.querySelector('.promptok-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'promptok-status success';
    }
  }

  showError(message) {
    this.removeExistingOverlay();
    
    const overlay = document.createElement('div');
    overlay.className = 'promptok-overlay';
    overlay.innerHTML = `
      <div class="promptok-card">
        <div class="promptok-header">
          <h4>⚠️ Enhancement Error</h4>
          <button class="promptok-close" aria-label="Close">×</button>
        </div>
        <div class="error-message">
          <p>${message}</p>
        </div>
        <div class="promptok-actions">
          <button id="promptok-close-error" class="primary">Close</button>
        </div>
      </div>
    `;
    
    this.addOverlayStyles(overlay);
    document.body.appendChild(overlay);
    
    // Add close listeners
    const closeBtn = overlay.querySelector('.promptok-close');
    const closeErrorBtn = overlay.querySelector('#promptok-close-error');
    
    const closeHandler = () => this.closeOverlay();
    closeBtn.addEventListener('click', closeHandler);
    closeErrorBtn.addEventListener('click', closeHandler);
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeHandler();
    });
  }

  minimizeOverlay() {
    const overlay = document.querySelector(`.${this.overlayClass}`);
    if (!overlay) return;
    
    this.debugLog('Minimizing overlay, preserving data');
    this.debugLog('Enhancement data before minimize:', !!this.currentEnhancementData);
    
    this.isMinimized = true;
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      overlay.remove();
      this.showMinimizedButton();
      // Persist session after minimizing
      this.saveSessionState().catch(() => {});
      this.debugLog('Overlay minimized, data preserved:', !!this.currentEnhancementData);
    }, 200);
  }

  showMinimizedButton() {
    // Remove any existing minimized button
    this.removeMinimizedButton();
    
    // Find the input field to position near it
    const input = this.detect();
    if (!input) return;
    
    const minimizedBtn = document.createElement('div');
    minimizedBtn.className = this.minimizedButtonClass;
    minimizedBtn.innerHTML = `✨`;
    minimizedBtn.title = `PromptOK enhancer (${this.selectedOptions.size} options selected)`;
    
    // Position near the input field
    this.positionMinimizedButton(input, minimizedBtn);
    
    // Add styles
    this.addMinimizedButtonStyles(minimizedBtn);
    
    // Add click handler to restore
    minimizedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.debugLog('Minimized button clicked!');
      this.debugLog('Enhancement data exists:', !!this.currentEnhancementData);
      this.debugLog('Is minimized state:', this.isMinimized);
      this.restoreOverlay();
    });
    
    // Insert into document body for better positioning control
    document.body.appendChild(minimizedBtn);
    
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
      existing.remove();
    }
  }

  closeOverlay() {
    this.debugLog('Closing overlay completely');
    const existing = document.querySelector(`.${this.overlayClass}`);
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 200);
    }
    
    this.removeMinimizedButton();
    this.selectedOptions.clear();
    this.currentEnhancementData = null;
    this.isMinimized = false;
    // Clear any persisted session
    this.clearSessionState().catch(() => {});
  }

  removeExistingOverlay() {
    // Pure DOM cleanup: remove any existing overlay without touching state
    const existing = document.querySelector(`.${this.overlayClass}`);
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 200);
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
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .promptok-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .promptok-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .promptok-header h4 {
        margin: 0;
        color: #1f2937;
        font-size: 18px;
        font-weight: 600;
      }
      
      .promptok-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
      }
      
      .promptok-close:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      .promptok-loading {
        text-align: center;
        padding: 40px 20px;
      }
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e5e7eb;
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .promptok-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }
      
      .promptok-actions button {
        flex: 1;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .promptok-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        align-items: center;
      }
      
      .promptok-actions button.primary {
        flex: 1;
        background: rgba(255,255,255,0.9);
        color: #667eea;
        border: none;
        font-weight: 600;
        padding: 12px 20px;
        border-radius: 8px;
        transition: all 0.2s;
      }
      
      .promptok-actions button.primary:hover {
        background: white;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .promptok-actions button.copy-icon {
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        color: rgba(255,255,255,0.9);
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        cursor: pointer;
        flex-shrink: 0;
      }
      
      .promptok-actions button.copy-icon:hover {
        background: rgba(255,255,255,0.2);
        color: white;
        transform: translateY(-1px);
      }
      
      .promptok-actions button.primary:hover {
        background: #2563eb;
      }
      
      .promptok-actions button.secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      
      .promptok-actions button.secondary:hover {
        background: #e5e7eb;
      }
      
      .promptok-status {
        margin-top: 16px;
        padding: 12px;
        border-radius: 6px;
        font-size: 14px;
        text-align: center;
      }
      
      .promptok-status.success {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #bbf7d0;
      }
      
      .error-message {
        padding: 20px 0;
        text-align: center;
        color: #dc2626;
      }
    `;
    overlay.appendChild(style);
  }

  positionMinimizedButton(input, button) {
    // Ensure input has relative positioning
    if (getComputedStyle(input).position === 'static') {
      input.style.position = 'relative';
    }
  }

  addMinimizedButtonStyles(button) {
    const style = document.createElement('style');
    style.textContent = `
      .${this.minimizedButtonClass} {
        position: fixed !important;
        right: 20px !important;
        top: 20px !important;
        transform: none !important;
        background: rgba(102, 126, 234, 0.9) !important;
        border-radius: 50% !important;
        width: 40px !important;
        height: 40px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 999999 !important;
        transition: all 0.2s ease !important;
        border: 2px solid rgba(255,255,255,0.3) !important;
        backdrop-filter: blur(10px) !important;
        font-size: 18px !important;
        color: white !important;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
        pointer-events: auto !important;
      }
      
      .${this.minimizedButtonClass}:hover {
        transform: scale(1.1) !important;
        background: rgba(102, 126, 234, 1) !important;
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6) !important;
      }
      
      .${this.minimizedButtonClass}:active {
        transform: scale(0.95) !important;
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(102, 126, 234, 0.25);
        color: white;
        overflow: auto;
        position: relative;
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
          min-width: 300px;
          max-height: 80vh;
        }
      }
      
      .promptok-card.enhanced .promptok-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .promptok-card.enhanced .promptok-header h4 {
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 0;
      }
      
      .header-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .promptok-card.enhanced .promptok-minimize,
      .promptok-card.enhanced .promptok-close {
        color: rgba(255,255,255,0.8);
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        width: 30px;
        height: 30px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .promptok-card.enhanced .promptok-minimize:hover,
      .promptok-card.enhanced .promptok-close:hover {
        background: rgba(255,255,255,0.2);
        color: white;
      }
      
      .enhanced-prompt-preview {
        margin-bottom: 24px;
        padding: 16px;
        background: rgba(255,255,255,0.1);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
      }
      
      .enhanced-prompt-preview h5 {
        margin: 0 0 12px 0;
        color: rgba(255,255,255,0.9);
        font-size: 14px;
        font-weight: 600;
      }
      
      .prompt-text {
        background: rgba(255,255,255,0.95);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.3);
        font-family: monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #1f2937;
        max-height: 120px;
        overflow-y: auto;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      
      .options-section h5 {
        margin: 0 0 8px 0;
        color: rgba(255,255,255,0.95);
        font-size: 16px;
        font-weight: 600;
      }
      
      .options-description {
        margin: 0 0 20px 0;
        color: rgba(255,255,255,0.8);
        font-size: 14px;
      }
      
      .option-group {
        margin-bottom: 20px;
        padding: 16px;
        background: rgba(255,255,255,0.1);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
      }
      
      .option-group h6 {
        margin: 0 0 8px 0;
        color: rgba(255,255,255,0.95);
        font-size: 14px;
        font-weight: 600;
      }
      
      .group-description {
        margin: 0 0 12px 0;
        color: rgba(255,255,255,0.8);
        font-size: 13px;
      }
      
      .options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .option-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        background: rgba(255,255,255,0.95);
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.3);
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .option-item:hover {
        border-color: rgba(255,255,255,0.5);
        background: white;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .option-item input[type="checkbox"] {
        margin: 0;
        cursor: pointer;
      }
      
      .option-content {
        flex: 1;
      }
      
      .option-label {
        display: block;
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 4px;
      }
      
      .option-short {
        display: block;
        font-size: 13px;
        color: #6b7280;
      }
      
      .option-item input[type="checkbox"]:checked + .option-content .option-label {
        color: #667eea;
        font-weight: 600;
      }
    `;
    overlay.appendChild(style);
  }

  async getStorageItem(key) {
    try {
      if (chrome?.storage?.local) {
        const result = await chrome.storage.local.get(key);
        return result[key];
      } else if (window.localStorage) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.warn(`Failed to get storage item '${key}':`, error);
    }
    return null;
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
      // Throttle observer calls
      if (this.observerTimeout) return;
      
      this.observerTimeout = setTimeout(() => {
        this.enhancer.detect();
        this.observerTimeout = null;
      }, 100);
    });

    this.observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true,
      attributes: false // Reduce observer overhead
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

// Initialize the enhancer
const enhancer = new AdvancedPromptEnhancer();

// Expose globally for debugging
window.promptOKEnhancer = enhancer;

// Start detection when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhancer.detect());
} else {
  enhancer.detect();
}

// Also run detection periodically for dynamic content
setInterval(() => enhancer.detect(), 2000);
