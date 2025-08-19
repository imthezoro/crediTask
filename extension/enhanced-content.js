class AdvancedPromptEnhancer {
  constructor() {
    this.currentEnhancementData = null;
    this.selectedOptions = new Set();
  }

  detect() {
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="prompt" i]',
      '[contenteditable="true"]',
    ];
    const input = document.querySelector(selectors.join(', '));
    if (input) {
      this.addEnhanceButton(input);
    }
    return input;
  }

  addEnhanceButton(input) {
    // Check if button already exists
    if (input.parentNode.querySelector('.promptok-enhance-button')) return;

    const button = document.createElement('button');
    button.className = 'promptok-enhance-button';
    button.innerHTML = '✨';
    button.title = 'Enhance prompt with AI';
    button.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      background: rgba(0,0,0,0.1);
      z-index: 1000;
    `;

    // Position the button relative to the input
    input.style.position = 'relative';
    input.style.paddingRight = '30px';
    
    // Add button next to input
    input.parentNode.insertBefore(button, input.nextSibling);
    
    // Start enhancement process on button click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
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
      
      // Parse the response to extract JSON
      const parsedData = this.parseEnhancementResponse(enhancementData);
      
      if (parsedData) {
        this.showEnhancementOptions(parsedData);
      } else {
        // Fallback to simple enhancement if JSON parsing fails
        this.applySimpleEnhancement(enhancementData);
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      this.showError('Failed to enhance prompt. Please try again.');
    }
  }

  async getEnhancementData(prompt) {
    // Get auth token from storage - try multiple possible keys
    let accessToken = await this.getStorageItem('access_token');
    
    if (!accessToken) {
      const authData = await this.getStorageItem('supabase.auth.token');
      accessToken = authData?.access_token;
    }
    
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in to use prompt enhancement.');
    }

    const response = await fetch('https://coqwcumwpixmrjqnmhkv.supabase.co/functions/v1/enhance-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        prompt: prompt,
        enhancementType: 'tone' // Temporary fix until Edge Function is redeployed
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Enhancement failed');
    }

    const data = await response.json();
    return data.enhancedPrompt;
  }

  parseEnhancementResponse(responseText) {
    try {
      // Extract JSON block from the response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
      if (!jsonMatch) {
        console.log('No JSON block found in response');
        return null;
      }

      const jsonText = jsonMatch[1];
      const parsed = JSON.parse(jsonText);
      
      // Validate required fields
      if (!parsed.enhanced_prompt || !parsed.assumption_groups) {
        console.log('Invalid JSON structure');
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      return null;
    }
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
    let html = '';
    
    for (const group of parsedData.assumption_groups || []) {
      html += `
        <div class="option-group" data-group-id="${group.group_id}">
          <h6>${group.title}</h6>
          <p class="group-description">${group.description || ''}</p>
          <div class="options">
      `;
      
      for (const option of group.options || []) {
        html += `
          <label class="option-item">
            <input type="checkbox" name="option" value="${option.option_id}" data-group="${group.group_id}">
            <div class="option-content">
              <span class="option-label">${option.label}</span>
              <span class="option-short">${option.short || ''}</span>
            </div>
          </label>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    }
    
    return html;
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
    let finalPrompt = parsedData.enhanced_prompt;
    
    // Create option map
    const optionMap = {};
    for (const group of parsedData.assumption_groups || []) {
      for (const option of group.options || []) {
        optionMap[option.option_id] = option.append_snippet || '';
      }
    }
    
    // Add selected option snippets
    const appendParts = [];
    for (const optionId of selectedOptionIds) {
      if (optionMap[optionId]) {
        appendParts.push(optionMap[optionId]);
      }
    }
    
    // Check for combination snippets
    const combos = parsedData.combination_snippets || [];
    const selSet = new Set(selectedOptionIds);
    for (const combo of combos) {
      const comboSet = new Set(combo.combo || []);
      // Check if combo is subset of selected options
      let isSubset = true;
      for (const v of comboSet) {
        if (!selSet.has(v)) {
          isSubset = false;
          break;
        }
      }
      if (isSubset && combo.append_snippet) {
        appendParts.push(combo.append_snippet);
      }
    }
    
    if (appendParts.length > 0) {
      finalPrompt += '\n\n' + appendParts.join('\n');
    }
    
    return finalPrompt;
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
    const existing = document.querySelector('.promptok-overlay');
    if (existing) {
      existing.remove();
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
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } else if (window.localStorage) {
      return JSON.parse(localStorage.getItem(key) || 'null');
    }
    return null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the enhanced prompt enhancer
const enhancer = new AdvancedPromptEnhancer();

// Set up observer to detect new inputs
let observer = null;

function setupObserver() {
  if (observer) return;
  
  observer = new MutationObserver(() => {
    const input = enhancer.detect();
    if (input) {
      // Input detected, enhancer button added
    }
  });

  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true,
    attributes: true
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  enhancer.detect();
  setupObserver();
});

// Also try to initialize immediately in case DOM is already loaded
enhancer.detect();
setupObserver();
