/**
 * CodeSpar - AI Coding Interview Coach
 * Modular JavaScript with Premium UX
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
  API_URL: '/api/chat',
  SESSION_KEY: 'codespar_session_id',
  MAX_TEXTAREA_HEIGHT: 200,
  TYPING_DELAY: 50,
  TOAST_DURATION: 4000
};

// ============================================
// State Management
// ============================================
const state = {
  sessionId: null,
  currentDifficulty: 'medium',
  isRecording: false,
  recognition: null,
  isLoading: false,
  messageCount: 0
};

// ============================================
// DOM Elements Cache
// ============================================
const elements = {};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  console.log('🚀 CodeSpar initializing...');

  cacheDOMElements();
  initializeSession();
  initializeSpeechRecognition();
  attachEventListeners();
  updateStatus('Ready', true);

  console.log('✅ CodeSpar ready');
}

function cacheDOMElements() {
  // Main containers
  elements.messages = document.getElementById('messages');
  elements.messageInput = document.getElementById('messageInput');
  elements.toastContainer = document.getElementById('toastContainer');

  // Buttons
  elements.sendBtn = document.getElementById('sendBtn');
  elements.voiceBtn = document.getElementById('voiceBtn');
  elements.clearSessionBtn = document.getElementById('clearSession');
  elements.difficultyBtns = document.querySelectorAll('.difficulty-btn');
  elements.suggestionChips = document.querySelectorAll('.chip');

  // Display elements
  elements.sessionIdDisplay = document.getElementById('sessionId');
  elements.totalMessages = document.getElementById('totalMessages');
  elements.topicsAttempted = document.getElementById('topicsAttempted');
  elements.topicList = document.getElementById('topicList');
  elements.statusText = document.getElementById('statusText');
  elements.statusDot = document.getElementById('statusDot');

  console.log('📦 DOM elements cached');
}

// ============================================
// Session Management
// ============================================
function initializeSession() {
  state.sessionId = localStorage.getItem(CONFIG.SESSION_KEY);

  if (!state.sessionId) {
    generateNewSession();
  }

  updateSessionDisplay();
}

function generateNewSession() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  state.sessionId = `session_${timestamp}_${random}`;
  localStorage.setItem(CONFIG.SESSION_KEY, state.sessionId);
}

function updateSessionDisplay() {
  if (elements.sessionIdDisplay) {
    elements.sessionIdDisplay.textContent = state.sessionId.substring(0, 12) + '...';
  }
}

// ============================================
// Speech Recognition
// ============================================
function initializeSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.log('🎤 Speech recognition not supported');
    hideVoiceButton();
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US';

  state.recognition.onstart = () => {
    state.isRecording = true;
    elements.voiceBtn?.classList.add('recording');
    updateStatus('Listening...', true);
  };

  state.recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');
    elements.messageInput.value = transcript;
    autoResizeTextarea();
  };

  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    state.isRecording = false;
    elements.voiceBtn?.classList.remove('recording');
    updateStatus('Voice input error', false);
    showToast('Voice Input Error', 'Could not understand audio. Please try again.', 'error');
  };

  state.recognition.onend = () => {
    state.isRecording = false;
    elements.voiceBtn?.classList.remove('recording');
    updateStatus('Ready', true);
  };

  console.log('🎤 Speech recognition initialized');
}

function hideVoiceButton() {
  if (elements.voiceBtn) {
    elements.voiceBtn.style.display = 'none';
  }
}

// ============================================
// Event Listeners
// ============================================
function attachEventListeners() {
  // Difficulty buttons
  elements.difficultyBtns?.forEach(btn => {
    btn.addEventListener('click', handleDifficultyChange);
  });

  // Suggestion chips
  elements.suggestionChips?.forEach(chip => {
    chip.addEventListener('click', handleSuggestionClick);
    chip.addEventListener('keydown', handleSuggestionKeyDown);
  });

  // Clear session
  elements.clearSessionBtn?.addEventListener('click', handleClearSession);

  // Voice button
  elements.voiceBtn?.addEventListener('click', handleVoiceToggle);

  // Send button
  elements.sendBtn?.addEventListener('click', handleSendMessage);

  // Textarea events
  elements.messageInput?.addEventListener('keydown', handleKeyDown);
  elements.messageInput?.addEventListener('input', handleInput);

  // Keyboard shortcut
  document.addEventListener('keydown', handleGlobalKeyDown);

  // Copy code buttons (event delegation)
  elements.messages?.addEventListener('click', handleMessageClick);

  console.log('🎧 Event listeners attached');
}

// ============================================
// Event Handlers
// ============================================
function handleDifficultyChange(event) {
  const btn = event.target;

  // Remove active from all
  elements.difficultyBtns.forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });

  // Add active to clicked
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  state.currentDifficulty = btn.dataset.level;

  // Visual feedback
  showToast('Difficulty Changed', `Set to ${state.currentDifficulty.charAt(0).toUpperCase() + state.currentDifficulty.slice(1)}`, 'success');
}

function handleSuggestionClick(event) {
  const chip = event.target;
  const text = chip.dataset.text;

  if (text && elements.messageInput) {
    elements.messageInput.value = text;
    autoResizeTextarea();
    handleSendMessage();
  }
}

function handleSuggestionKeyDown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleSuggestionClick(event);
  }
}

async function handleClearSession() {
  if (!confirm('Clear this session? Your chat history will be reset.')) {
    return;
  }

  updateStatus('Clearing...', true);

  try {
    const response = await fetch('/api/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId })
    });

    if (!response.ok) {
      throw new Error('Failed to clear session');
    }

    // Reset UI
    resetChatUI();

    showToast('Session Cleared', 'Chat history was cleared for this session.', 'success');
    updateStatus('Ready', true);

  } catch (error) {
    console.error('Failed to clear session:', error);
    showToast('Error', 'Failed to clear session. Please try again.', 'error');
    updateStatus('Error', false);
  }
}

function handleVoiceToggle() {
  if (!state.recognition) {
    showToast('Not Supported', 'Voice input is not supported in your browser', 'warning');
    return;
  }

  if (state.isRecording) {
    state.recognition.stop();
  } else {
    try {
      state.recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      showToast('Error', 'Could not start voice recording', 'error');
    }
  }
}

async function handleSendMessage() {
  if (state.isLoading) return;

  const message = elements.messageInput?.value.trim();
  if (!message) return;

  // Hide welcome screen
  hideWelcomeScreen();

  // Add user message
  addMessage(message, 'user');
  clearInput();

  // Show loading state
  setLoading(true);
  const typingId = showTyping();
  updateStatus('Thinking...', true);

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        message,
        difficulty: state.currentDifficulty
      })
    });

    removeTyping(typingId);
    setLoading(false);

    if (!response.ok) {
      let apiError = `HTTP error! status: ${response.status}`;
      try {
        const errData = await response.json();
        if (errData?.error) {
          apiError = errData.error;
        }
      } catch (parseError) {
        // Keep the default HTTP error when response isn't valid JSON.
      }
      throw new Error(apiError);
    }

    const data = await response.json();
    const reply = typeof data?.reply === 'string' ? data.reply : null;

    if (!reply) {
      throw new Error('Invalid AI response payload');
    }

    // Add AI response with typing effect
    await addMessageWithTyping(reply, 'assistant');

    // Update stats
    updateStats(data);

    // Optional: Text-to-speech
    speakResponse(reply);

    updateStatus('Ready', true);

  } catch (error) {
    console.error('Error:', error);
    removeTyping(typingId);
    setLoading(false);
    addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    showToast('Connection Error', 'Failed to get response from AI', 'error');
    updateStatus('Error', false);
  }
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
}

function handleInput() {
  autoResizeTextarea();
}

function handleGlobalKeyDown(event) {
  // Ctrl+/ to focus input
  if (event.ctrlKey && event.key === '/') {
    event.preventDefault();
    elements.messageInput?.focus();
  }

  // Escape to blur input
  if (event.key === 'Escape') {
    elements.messageInput?.blur();
  }
}

function handleMessageClick(event) {
  // Handle copy button clicks
  if (event.target.closest('.copy-code-btn')) {
    const button = event.target.closest('.copy-code-btn');
    const pre = button.closest('pre');
    const code = pre?.querySelector('code');

    if (code) {
      copyToClipboard(code.textContent, button);
    }
  }
}

// ============================================
// UI Helpers
// ============================================
function hideWelcomeScreen() {
  const welcome = elements.messages?.querySelector('.welcome');
  if (welcome) {
    welcome.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => welcome.remove(), 300);
  }
}

function resetChatUI() {
  elements.messages.innerHTML = `
    <div class="welcome">
      <h2>Session Cleared 🎉</h2>
      <p>Start fresh! Ask me about any coding interview topic.</p>
      <div class="suggestion-chips" role="list" aria-label="Suggested questions">
        <span class="chip" data-text="How do I reverse a linked list?" role="listitem" tabindex="0">Reverse a linked list</span>
        <span class="chip" data-text="Explain binary search" role="listitem" tabindex="0">Binary search</span>
        <span class="chip" data-text="Design a rate limiter" role="listitem" tabindex="0">Design a rate limiter</span>
        <span class="chip" data-text="Two pointers technique" role="listitem" tabindex="0">Two pointers</span>
        <span class="chip" data-text="Dynamic programming basics" role="listitem" tabindex="0">Dynamic programming</span>
      </div>
    </div>
  `;

  // Re-attach chip listeners
  elements.suggestionChips = document.querySelectorAll('.chip');
  elements.suggestionChips.forEach(chip => {
    chip.addEventListener('click', handleSuggestionClick);
    chip.addEventListener('keydown', handleSuggestionKeyDown);
  });

  // Reset stats
  elements.totalMessages.textContent = '0';
  elements.topicsAttempted.textContent = '0';
  elements.topicList.innerHTML = '<li class="empty-state">No topics yet. Start practicing!</li>';
}

function clearInput() {
  if (elements.messageInput) {
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
  }
}

function autoResizeTextarea() {
  if (!elements.messageInput) return;

  elements.messageInput.style.height = 'auto';
  const newHeight = Math.min(
    elements.messageInput.scrollHeight,
    CONFIG.MAX_TEXTAREA_HEIGHT
  );
  elements.messageInput.style.height = newHeight + 'px';
}

function setLoading(loading) {
  state.isLoading = loading;
  if (elements.sendBtn) {
    elements.sendBtn.disabled = loading;
    elements.sendBtn.classList.toggle('loading', loading);
  }
}

function updateStatus(text, online) {
  if (elements.statusText) {
    elements.statusText.textContent = text;
  }
  if (elements.statusDot) {
    elements.statusDot.className = 'status-dot' + (online ? '' : ' offline');
  }
}

function updateStats(data) {
  if (data.totalMessages !== undefined) {
    elements.totalMessages.textContent = data.totalMessages;
  }
  if (data.topicHints || data.topicsAttempted) {
    updateTopicsList();
  }
}

// ============================================
// Message Rendering
// ============================================
function addMessage(content, role) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  const safeContent = typeof content === 'string' ? content : 'Unable to display message.';
  const processedContent = processMessageContent(safeContent);
  messageEl.innerHTML = processedContent;

  elements.messages.appendChild(messageEl);
  scrollToBottom();

  // Add copy buttons to code blocks
  addCopyButtons(messageEl);

  // Highlight code
  messageEl.querySelectorAll('pre code').forEach(block => {
    if (window.hljs) {
      hljs.highlightElement(block);
    }
  });

  state.messageCount++;
}

async function addMessageWithTyping(content, role) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  messageEl.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  elements.messages.appendChild(messageEl);
  scrollToBottom();

  // Small delay to simulate processing
  await new Promise(resolve => setTimeout(resolve, 300));

  const safeContent = typeof content === 'string' ? content : 'Unable to display message.';
  const processedContent = processMessageContent(safeContent);
  messageEl.innerHTML = processedContent;

  // Add copy buttons and highlight
  addCopyButtons(messageEl);
  messageEl.querySelectorAll('pre code').forEach(block => {
    if (window.hljs) {
      hljs.highlightElement(block);
    }
  });

  state.messageCount++;
}

function processMessageContent(content) {
  if (typeof content !== 'string') {
    return 'Unable to display message.';
  }

  return content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, (match, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\n/g, '<br>');
}

function addCopyButtons(messageEl) {
  const pres = messageEl.querySelectorAll('pre');
  pres.forEach(pre => {
    const button = document.createElement('button');
    button.className = 'copy-code-btn';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy
    `;
    pre.appendChild(button);
  });
}

function showTyping() {
  const id = 'typing-' + Date.now();
  const typingEl = document.createElement('div');
  typingEl.id = id;
  typingEl.className = 'message assistant typing';
  typingEl.innerHTML = '<span></span><span></span><span></span>';

  elements.messages.appendChild(typingEl);
  scrollToBottom();

  return id;
}

function removeTyping(id) {
  const typingEl = document.getElementById(id);
  if (typingEl) {
    typingEl.remove();
  }
}

function scrollToBottom() {
  if (elements.messages) {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
}

// ============================================
// Topic List
// ============================================
async function updateTopicsList() {
  try {
    const response = await fetch(`/api/session/${state.sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session');

    const data = await response.json();
    const topics = data.topicsAttempted || {};
    const topicEntries = Object.entries(topics);

    if (elements.topicsAttempted) {
      elements.topicsAttempted.textContent = topicEntries.length;
    }

    if (topicEntries.length === 0) {
      if (elements.topicList) {
        elements.topicList.innerHTML = '<li class="empty-state">No topics yet. Start practicing!</li>';
      }
      return;
    }

    const sortedTopics = topicEntries
      .sort((a, b) => b[1].lastAttempt - a[1].lastAttempt)
      .slice(0, 10);

    if (elements.topicList) {
      elements.topicList.innerHTML = sortedTopics
        .map(([topic, info]) => `
          <li>
            <span>${escapeHtml(topic)}</span>
            <span class="attempts">${info.attempts} try${info.attempts !== 1 ? 'ies' : 'y'}</span>
          </li>
        `).join('');
    }

  } catch (error) {
    console.error('Failed to update topics:', error);
  }
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add('copied');
    button.innerHTML = 'Copied!';

    setTimeout(() => {
      button.classList.remove('copied');
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      `;
    }, 2000);

    showToast('Copied', 'Code copied to clipboard', 'success');
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Error', 'Failed to copy to clipboard', 'error');
  }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(title, message, type = 'info') {
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = getToastIcon(type);

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close notification">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  elements.toastContainer.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => hideToast(toast));

  // Auto remove
  setTimeout(() => hideToast(toast), CONFIG.TOAST_DURATION);
}

function hideToast(toast) {
  if (!toast || toast.dataset.hiding) return;

  toast.dataset.hiding = 'true';
  toast.classList.add('hiding');

  setTimeout(() => toast.remove(), 300);
}

function getToastIcon(type) {
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>`
  };
  return icons[type] || icons.info;
}

// ============================================
// Text-to-Speech
// ============================================
function speakResponse(text) {
  if (!('speechSynthesis' in window)) return;

  // Remove code blocks and markdown from speech
  const speechText = text
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/\n/g, ' ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;

  window.speechSynthesis.speak(utterance);
}

// ============================================
// Export for testing (if needed)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml, processMessageContent };
}
