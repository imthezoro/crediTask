class SimplePromptDetector {
  detect() {
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="prompt" i]',
      '[contenteditable="true"]',
    ];
    return document.querySelector(selectors.join(', '));
  }
}

function buildOverlay(options) {
  const overlay = document.createElement('div');
  overlay.className = 'promptok-overlay';
  overlay.innerHTML = `
    <div class="promptok-card">
      <h4>Clarify your prompt</h4>
      ${options
        .map(
          (opt) => `
        <label>
          <input type="radio" name="promptok-choice" value="${opt.value}">
          ${opt.label}
        </label>`
        )
        .join('')}
      <div class="promptok-actions">
        <button id="promptok-enhance">Enhance</button>
        <button id="promptok-close">Close</button>
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
  overlay.querySelector('#promptok-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#promptok-enhance').addEventListener('click', enhancePrompt);
}

async function enhancePrompt() {
  const input = new SimplePromptDetector().detect();
  if (!input) return;
  const prompt = input.value || input.textContent || '';
  const site = location.host;
  try {
    const token = await chrome.storage.local.get(['access_token']).then((r) => r.access_token);
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt, site }),
    });
    const data = await res.json();
    console.log('PromptOK analysis', data);
  } catch (e) {
    console.error('PromptOK error', e);
  }
}

function init() {
  const detector = new SimplePromptDetector();
  const input = detector.detect();
  if (!input) return;
  const options = [
    { value: 'tone', label: 'What tone should the output have?' },
    { value: 'length', label: 'Desired length?' },
    { value: 'audience', label: 'Who is the audience?' },
  ];
  showEnhancementOptions(options);
}

const observer = new MutationObserver(() => {
  if (!document.querySelector('.promptok-overlay')) init();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
init();


