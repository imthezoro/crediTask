class SimplePromptDetector {
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
    button.title = 'Enhance prompt';
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
    
    // Toggle overlay on button click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const existingOverlay = document.querySelector('.promptok-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      } else {
        init();
      }
    });
  }
}

function buildOverlay(options) {
  const overlay = document.createElement('div');
  overlay.className = 'promptok-overlay';
  overlay.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .promptok-overlay {
        animation: fadeIn 0.2s ease-out forwards;
      }
      .promptok-option {
        transition: all 0.2s ease;
        border-radius: 4px;
        padding: 4px 8px;
        margin: 4px 0;
      }
      .promptok-option.selected {
        background: rgba(59, 130, 246, 0.1);
      }
      .promptok-status {
        padding: 8px;
        margin: 8px 0;
        border-radius: 4px;
        font-size: 13px;
        transition: opacity 0.3s ease;
      }
      .promptok-status.success {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
      }
      .promptok-status.error {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      .promptok-status.info {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
    </style>
    <div class="promptok-card">
      <h4>Clarify your prompt</h4>
      <div class="promptok-options">
        ${options
          .map(
            (opt) => `
          <label class="promptok-option">
            <input type="radio" name="promptok-choice" value="${opt.value}">
            <span>${opt.label}</span>
          </label>`
          )
          .join('')}
      </div>
      <div class="promptok-actions">
        <button id="promptok-enhance">Enhance</button>
        <button id="promptok-close" class="secondary">Close</button>
      </div>
    </div>
  `;
  return overlay;
}

function showEnhancementOptions(options) {
  const existing = document.querySelector('.promptok-overlay');
  if (existing) existing.remove();
  const overlay = buildOverlay(options);
  document.body.appendChild(overlay);
  
  // Add fade-out animation for close button
  const closeButton = overlay.querySelector('#promptok-close');
  const closeOverlay = (e) => {
    if (e) e.stopPropagation();
    isUserClosed = true;
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.remove();
      }
    }, 300);
  };

  closeButton.addEventListener('click', closeOverlay);
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeOverlay(e);
    }
  });
  
  // Handle radio button selection
  const radioInputs = overlay.querySelectorAll('input[type="radio"]');
  radioInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Remove selected class from all options
      document.querySelectorAll('.promptok-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      // Add selected class to parent label
      if (e.target.checked) {
        e.target.closest('label').classList.add('selected');
      }
    });
  });
  
  // Handle enhance button click
  const enhanceButton = overlay.querySelector('#promptok-enhance');
  enhanceButton.addEventListener('click', () => {
    const selectedOption = overlay.querySelector('input[type="radio"]:checked');
    if (!selectedOption) {
      showStatus(overlay, 'Please select an option', 'error');
      return;
    }
    enhancePrompt(selectedOption.value);
  });
  
  return overlay;
}

// Show status message in the overlay
function showStatus(overlay, message, type = 'info') {
  let statusEl = overlay.querySelector('.promptok-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'promptok-status';
    overlay.querySelector('.promptok-actions').before(statusEl);
  }
  statusEl.textContent = message;
  statusEl.className = `promptok-status ${type}`;
  
  if (type !== 'error') {
    setTimeout(() => {
      statusEl.style.opacity = '0';
      setTimeout(() => statusEl.remove(), 300);
    }, 2000);
  }
}

async function enhancePrompt(enhancementType) {
  const input = new SimplePromptDetector().detect();
  if (!input) return;
  
  const prompt = input.value || input.textContent || '';
  const site = location.host;
  const overlay = document.querySelector('.promptok-overlay');
  
  // Show loading state
  const enhanceButton = overlay?.querySelector('#promptok-enhance');
  const originalButtonText = enhanceButton?.textContent;
  if (enhanceButton) {
    enhanceButton.disabled = true;
    enhanceButton.textContent = 'Enhancing...';
  }
  
  try {
    // Use API for enhancement
    const enhancedPrompt = await enhanceWithAPI(prompt, enhancementType);
    
    // Update the input field with enhanced prompt
    if (input.value !== undefined) {
      input.value = enhancedPrompt;
    } else if (input.textContent !== undefined) {
      input.textContent = enhancedPrompt;
    }
    
    // Show success message
    if (overlay) {
      showStatus(overlay, 'Prompt enhanced!', 'success');
      
      // Close the overlay after a short delay
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }, 1000);
    }
    
  } catch (error) {
    console.error('Enhancement error:', error);
    if (overlay) {
      showStatus(overlay, 'Failed to enhance prompt', 'error');
    }
  } finally {
    if (enhanceButton) {
      enhanceButton.disabled = false;
      enhanceButton.textContent = originalButtonText;
    }
  }
}

// Enhanced prompt function using Edge Function API
async function enhanceWithAPI(prompt, enhancementType) {
  try {
    // Get auth token from storage
    const authData = await storage.get('supabase.auth.token');
    if (!authData?.access_token) {
      throw new Error('Not authenticated');
    }

    if (!window.promptokEnvConfig) {
      throw new Error('Environment configuration not loaded');
    }
    
    const supabaseUrl = await window.promptokEnvConfig.getSupabaseUrl();
    const response = await fetch(`${supabaseUrl}/functions/v1/enhance-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`
      },
      body: JSON.stringify({
        prompt: prompt,
        enhancementType: enhancementType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Enhancement failed');
    }

    const data = await response.json();
    return data.enhancedPrompt;
  } catch (error) {
    console.error('API enhancement failed:', error);
    
    // Fallback to simple enhancements if API fails
    const fallbackEnhancements = {
      'tone': `[Professional tone] ${prompt}`,
      'length': `[Detailed version] ${prompt} - Please provide a comprehensive response.`,
      'audience': `[For general audience] ${prompt}`,
      'clarity': `[Clear and specific] ${prompt}`,
      'structure': `[Well-structured] ${prompt}`
    };
    
    return fallbackEnhancements[enhancementType] || prompt;
  }
}

function init() {
  const detector = new SimplePromptDetector();
  const input = detector.detect();
  if (!input) return;
  const options = [
    { value: 'tone', label: 'Improve tone and professionalism' },
    { value: 'length', label: 'Make more detailed and comprehensive' },
    { value: 'audience', label: 'Optimize for target audience' },
    { value: 'clarity', label: 'Enhance clarity and specificity' },
    { value: 'structure', label: 'Improve structure and organization' },
  ];
  showEnhancementOptions(options);
}

let isUserClosed = false;
let observer = null;

function setupObserver() {
  // Only set up observer if not already set up
  if (observer) return;
  
  observer = new MutationObserver((mutations) => {
    // Skip if user manually closed the overlay
    if (isUserClosed) return;
    
    // Check if the overlay exists and is visible
    const overlay = document.querySelector('.promptok-overlay');
    if (!overlay) {
      const input = new SimplePromptDetector().detect();
      if (input) {
        // Reset the flag when a new input is detected
        isUserClosed = false;
        init();
      }
    }
  });

  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true,
    attributes: true,
    characterData: true
  });
}

// Storage wrapper with fallback
const storage = {
  get: async (key) => {
    if (chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } else if (window.localStorage) {
      return JSON.parse(localStorage.getItem(key));
    }
    return null;
  },
  set: async (key, value) => {
    if (chrome.storage && chrome.storage.local) {
      return chrome.storage.local.set({ [key]: value });
    } else if (window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    }
    return Promise.reject('No storage available');
  }
};

// Initialize only once when the page loads
const input = new SimplePromptDetector().detect();
if (input) {
  // Don't auto-show the overlay on page load
  setupObserver();
}


