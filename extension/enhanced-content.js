class AdvancedPromptEnhancer {
  constructor() {
    this.currentEnhancementData = null;
    this.selectedOptions = new Set();
    this.apiEndpoint = 'https://coqwcumwpixmrjqnmhkv.supabase.co/functions/v1/enhance-prompt';
    this.buttonClass = 'promptok-enhance-button';
    this.overlayClass = 'promptok-overlay';
  }

  detect() {
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="ask" i]',
      '[contenteditable="true"]',
      'input[type="text"][placeholder*="prompt" i]'
    ];
    const input = document.querySelector(selectors.join(', '));
    if (input && !this.hasEnhanceButton(input)) {
      this.addEnhanceButton(input);
    }
    return input;
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
      <div class="promptok-card enhanced">
        <div class="promptok-header">
          <h4>✨ Enhanced Prompt Ready</h4>
          <button class="promptok-close" aria-label="Close">×</button>
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
          <button id="promptok-apply" class="primary">Apply Enhanced Prompt</button>
          <button id="promptok-apply-with-options" class="secondary">Apply with Selected Options</button>
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
    const optionsHTML = (group.options || [])
      .map(option => this.buildOptionHTML(option, groupId))
      .join('');

    return `
      <div class="option-group" data-group-id="${groupId}">
        <h6>${title}</h6>
        <p class="group-description">${description}</p>
        <div class="options">${optionsHTML}</div>
      </div>
    `;
  }

  buildOptionHTML(option, groupId) {
    const optionId = this.escapeHtml(option.option_id || '');
    const label = this.escapeHtml(option.label || '');
    const short = this.escapeHtml(option.short || '');

    return `
      <label class="option-item">
        <input type="checkbox" name="option" value="${optionId}" data-group="${groupId}">
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
    closeBtn.addEventListener('click', () => this.removeExistingOverlay());
    
    // Apply base enhanced prompt
    const applyBtn = overlay.querySelector('#promptok-apply');
    applyBtn.addEventListener('click', () => {
      this.applyEnhancedPrompt(parsedData.enhanced_prompt);
    });
    
    // Apply with selected options
    const applyWithOptionsBtn = overlay.querySelector('#promptok-apply-with-options');
    applyWithOptionsBtn.addEventListener('click', () => {
      this.applyEnhancedPromptWithOptions(parsedData);
    });
    
    // Option selection handling
    const checkboxes = overlay.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedOptions.add(e.target.value);
        } else {
          this.selectedOptions.delete(e.target.value);
        }
        this.updateApplyButtonText(overlay);
      });
    });
    
    // Close when clicking outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.removeExistingOverlay();
      }
    });
  }

  updateApplyButtonText(overlay) {
    const btn = overlay.querySelector('#promptok-apply-with-options');
    const count = this.selectedOptions.size;
    btn.textContent = count > 0 ? `Apply with ${count} Option${count > 1 ? 's' : ''}` : 'Apply with Selected Options';
  }

  applyEnhancedPrompt(enhancedPrompt) {
    const input = this.detect();
    if (!input) return;
    
    // Update the input field
    if (input.value !== undefined) {
      input.value = enhancedPrompt;
    } else if (input.textContent !== undefined) {
      input.textContent = enhancedPrompt;
    }
    
    // Trigger input event to notify the page
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    this.showSuccess('Base enhanced prompt applied!');
    setTimeout(() => this.removeExistingOverlay(), 1500);
  }

  applyEnhancedPromptWithOptions(parsedData) {
    const finalPrompt = this.buildFinalPrompt(parsedData, Array.from(this.selectedOptions));
    
    const input = this.detect();
    if (!input) return;
    
    // Update the input field
    if (input.value !== undefined) {
      input.value = finalPrompt;
    } else if (input.textContent !== undefined) {
      input.textContent = finalPrompt;
    }
    
    // Trigger input event to notify the page
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    const count = this.selectedOptions.size;
    this.showSuccess(`Enhanced prompt applied with ${count} customization${count > 1 ? 's' : ''}!`);
    setTimeout(() => this.removeExistingOverlay(), 1500);
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
    
    // Update the input field
    if (input.value !== undefined) {
      input.value = enhancedText;
    } else if (input.textContent !== undefined) {
      input.textContent = enhancedText;
    }
    
    // Trigger input event
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
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
    
    const closeHandler = () => this.removeExistingOverlay();
    closeBtn.addEventListener('click', closeHandler);
    closeErrorBtn.addEventListener('click', closeHandler);
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeHandler();
    });
  }

  removeExistingOverlay() {
    const existing = document.querySelector(`.${this.overlayClass}`);
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 200);
    }
    this.selectedOptions.clear();
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
      
      .promptok-actions button.primary {
        background: #3b82f6;
        color: white;
        border: none;
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

  addEnhancedStyles(overlay) {
    const style = document.createElement('style');
    style.textContent = `
      .enhanced-prompt-preview {
        margin-bottom: 24px;
        padding: 16px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      
      .enhanced-prompt-preview h5 {
        margin: 0 0 12px 0;
        color: #374151;
        font-size: 14px;
        font-weight: 600;
      }
      
      .prompt-text {
        background: white;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        font-family: monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #1f2937;
        max-height: 120px;
        overflow-y: auto;
      }
      
      .options-section h5 {
        margin: 0 0 8px 0;
        color: #374151;
        font-size: 16px;
        font-weight: 600;
      }
      
      .options-description {
        margin: 0 0 20px 0;
        color: #6b7280;
        font-size: 14px;
      }
      
      .option-group {
        margin-bottom: 20px;
        padding: 16px;
        background: #fafbfc;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      
      .option-group h6 {
        margin: 0 0 8px 0;
        color: #1f2937;
        font-size: 14px;
        font-weight: 600;
      }
      
      .group-description {
        margin: 0 0 12px 0;
        color: #6b7280;
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
        background: white;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .option-item:hover {
        border-color: #3b82f6;
        background: #f8fafc;
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
        color: #3b82f6;
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
    this.isInitialized = false;
  }
}

// Initialize manager
const enhancerManager = new PromptEnhancerManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhancerManager.init());
} else {
  enhancerManager.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => enhancerManager.destroy());
