/// <reference types="@cloudflare/workers-types" />

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export interface Env {
  AI: any;
  CHAT_SESSIONS: DurableObjectNamespace;
  __STATIC_CONTENT: KVNamespace;
}

// Session state interface
interface SessionState {
  messages: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  topicsAttempted: Record<string, {
    attempts: number;
    hintsGiven: number;
    solved: boolean;
    lastAttempt: number;
  }>;
  currentProblem?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
  lastActivity: number;
}

// System prompt for Socratic interview coaching
const SYSTEM_PROMPT = `You are CodeSpar, an expert coding interview coach who uses the Socratic method to help users learn. Your role is to guide users through coding problems by asking thought-provoking questions rather than giving direct answers.

Core Principles:
1. NEVER give the complete solution immediately
2. Always ask guiding questions to help users discover answers themselves
3. Encourage thinking about edge cases and time/space complexity
4. Help users develop problem-solving intuition
5. Be encouraging and patient

Guidelines:
- If the user asks "How do I...?", respond with clarifying questions or hints
- Break complex problems into smaller, manageable questions
- Ask about edge cases and test scenarios
- Guide toward writing pseudocode before actual code
- When the user shares code, ask them to trace through it with an example
- Celebrate small wins and progress
- If stuck for 3+ attempts, give a more direct hint but not the full solution

Topics you can help with:
- Data structures (arrays, linked lists, trees, graphs, hash maps, heaps)
- Algorithms (sorting, searching, dynamic programming, graph traversal)
- System design (scalability, caching, load balancing, databases)
- Object-oriented design
- Time and space complexity analysis

Response Format:
Keep responses conversational, supportive, and focused on guiding the user's thinking process. Use code formatting only when illustrating concepts or reviewing user code.`;

// CORS headers for Pages frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Route: Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'CodeSpar API' });
    }

    // Route: Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    // Route: Get session history
    if (url.pathname.startsWith('/api/session/') && request.method === 'GET') {
      const sessionId = url.pathname.split('/').pop();
      if (sessionId) {
        return handleGetSession(sessionId, env);
      }
    }

    // Route: Clear session
    if (url.pathname === '/api/clear' && request.method === 'POST') {
      return handleClearSession(request, env);
    }

    // Route: Serve static frontend assets from the configured site bucket.
    // This ensures app.js and styles.css are returned as real assets, not HTML.
    if (!url.pathname.startsWith('/api/')) {
      return serveFrontendAsset(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

async function serveFrontendAsset(request: Request, env: Env): Promise<Response> {
  try {
    const assetResponse = await getAssetFromKV(
      {
        request,
        waitUntil: () => {},
      } as any,
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
      }
    );

    return new Response(assetResponse.body, assetResponse);
  } catch (error) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return serveHTML();
    }

    return new Response('Not found', { status: 404 });
  }
}

// Handle chat requests
async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      sessionId: string;
      message: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };

    const { sessionId, message, difficulty = 'medium' } = body;

    if (!sessionId || !message) {
      return jsonResponse({ error: 'Missing sessionId or message' }, 400);
    }

    // Get or create Durable Object instance
    const id = env.CHAT_SESSIONS.idFromName(sessionId);
    const session = env.CHAT_SESSIONS.get(id);

    // Forward request to Durable Object
    const response = await session.fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, difficulty }),
    });

    const result = await response.json();
    return jsonResponse(result);

  } catch (error) {
    console.error('Chat error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// Get session history
async function handleGetSession(sessionId: string, env: Env): Promise<Response> {
  try {
    const id = env.CHAT_SESSIONS.idFromName(sessionId);
    const session = env.CHAT_SESSIONS.get(id);

    const response = await session.fetch(`/session/${sessionId}`, {
      method: 'GET',
    });

    const result = await response.json();
    return jsonResponse(result);

  } catch (error) {
    console.error('Get session error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// Clear session data
async function handleClearSession(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { sessionId: string };
    const { sessionId } = body;

    if (!sessionId) {
      return jsonResponse({ error: 'Missing sessionId' }, 400);
    }

    const id = env.CHAT_SESSIONS.idFromName(sessionId);
    const session = env.CHAT_SESSIONS.get(id);

    await session.fetch('/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    return jsonResponse({ success: true, message: 'Session cleared' });

  } catch (error) {
    console.error('Clear session error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// Helper for JSON responses
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Serve HTML for the root path
async function serveHTML(): Promise<Response> {
  // For now, return a redirect to the static asset
  // The site binding uploads assets to /index.html
  return new Response(getIndexHTML(), {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
    },
  });
}

// Embedded HTML content (simplified version that loads the full app)
function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeSpar - AI Coding Interview Coach</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
  <style>
    :root { --primary: #f48120; --bg-dark: #1a1a1a; --bg-card: #252525; --text: #e0e0e0; --text-muted: #888; --border: #333; --accent: #00d4aa; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-dark); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { display: flex; align-items: center; gap: 0.75rem; }
    .logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), #d9650c); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.25rem; }
    .logo h1 { font-size: 1.5rem; font-weight: 600; }
    .logo span { color: var(--primary); }
    main { flex: 1; display: flex; overflow: hidden; }
    .sidebar { width: 280px; background: var(--bg-card); border-right: 1px solid var(--border); padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
    .sidebar-section h3 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem; }
    .difficulty-selector { display: flex; gap: 0.5rem; }
    .difficulty-btn { flex: 1; padding: 0.5rem; border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .difficulty-btn.active { background: var(--primary); border-color: var(--primary); color: white; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .stat { text-align: center; padding: 1rem; background: var(--bg-dark); border-radius: 8px; }
    .stat-value { font-size: 1.5rem; font-weight: 600; color: var(--accent); }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
    .chat-container { flex: 1; display: flex; flex-direction: column; }
    .messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .welcome { text-align: center; padding: 3rem 2rem; color: var(--text-muted); }
    .welcome h2 { color: var(--text); margin-bottom: 1rem; font-size: 1.75rem; }
    .message { max-width: 85%; padding: 1rem; border-radius: 12px; line-height: 1.6; }
    .message.user { align-self: flex-end; background: var(--primary); color: white; }
    .message.assistant { align-self: flex-start; background: var(--bg-card); border: 1px solid var(--border); }
    .input-container { border-top: 1px solid var(--border); padding: 1rem 1.5rem; background: var(--bg-card); }
    .input-wrapper { display: flex; gap: 0.75rem; align-items: flex-end; }
    textarea { flex: 1; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem 1rem; color: var(--text); font-size: 1rem; resize: none; min-height: 52px; max-height: 200px; font-family: inherit; }
    textarea:focus { outline: none; border-color: var(--primary); }
    .icon-btn { width: 48px; height: 48px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text); border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .icon-btn.recording { background: #ff4444; color: white; }
    .send-btn { width: 48px; height: 48px; background: var(--primary); border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .typing { display: flex; gap: 0.25rem; padding: 1rem; }
    .typing span { width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typing 1.4s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } }
    @media (max-width: 768px) { .sidebar { display: none; } }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <div class="logo-icon">CS</div>
      <h1>Code<span>Spar</span></h1>
    </div>
  </header>
  <main>
    <aside class="sidebar">
      <div class="sidebar-section">
        <h3>Difficulty</h3>
        <div class="difficulty-selector">
          <button class="difficulty-btn" data-level="easy">Easy</button>
          <button class="difficulty-btn active" data-level="medium">Medium</button>
          <button class="difficulty-btn" data-level="hard">Hard</button>
        </div>
      </div>
      <div class="sidebar-section">
        <h3>Progress</h3>
        <div class="stats">
          <div class="stat"><div class="stat-value" id="totalMessages">0</div><div class="stat-label">Messages</div></div>
          <div class="stat"><div class="stat-value" id="topicsCount">0</div><div class="stat-label">Topics</div></div>
        </div>
      </div>
    </aside>
    <div class="chat-container">
      <div class="messages" id="messages">
        <div class="welcome">
          <h2>Welcome to CodeSpar</h2>
          <p>Your AI coding interview coach. Ask me about data structures, algorithms, or system design!</p>
        </div>
      </div>
      <div class="input-container">
        <div class="input-wrapper">
          <textarea id="input" placeholder="Ask a coding question..."></textarea>
          <button class="icon-btn" id="voiceBtn" title="Voice">🎤</button>
          <button class="send-btn" id="sendBtn">➤</button>
        </div>
      </div>
    </div>
  </main>
  <script>
    const API_URL = '/api/chat';
    const SESSION_KEY = 'codespar_session';
    let sessionId = localStorage.getItem(SESSION_KEY) || 'sess_' + Date.now();
    localStorage.setItem(SESSION_KEY, sessionId);
    let currentDifficulty = 'medium';
    let recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognition) recognition = new recognition();

    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');

    function addMessage(content, role) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = content.replace(/\n/g, '<br>');
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
      const id = 'typing-' + Date.now();
      const div = document.createElement('div');
      div.id = id;
      div.className = 'message assistant typing';
      div.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return id;
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      document.querySelector('.welcome')?.remove();
      addMessage(text, 'user');
      const typingId = showTyping();
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text, difficulty: currentDifficulty })
        });
        const data = await res.json();
        document.getElementById(typingId).remove();
        addMessage(data.reply, 'assistant');
        document.getElementById('totalMessages').textContent = data.totalMessages || 0;
        if (data.topicHints) {
          document.getElementById('topicsCount').textContent = Object.keys(data.topicHints).length;
        }
      } catch (e) {
        document.getElementById(typingId).remove();
        addMessage('Error: Could not get response', 'assistant');
      }
    }

    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.level;
      });
    });
    if (recognition) {
      let isRecording = false;
      recognition.continuous = false;
      recognition.interimResults = true;
      const voiceBtn = document.getElementById('voiceBtn');
      voiceBtn.addEventListener('click', () => {
        if (isRecording) { recognition.stop(); isRecording = false; voiceBtn.classList.remove('recording'); }
        else { recognition.start(); isRecording = true; voiceBtn.classList.add('recording'); }
      });
      recognition.onresult = e => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        inputEl.value = transcript;
      };
      recognition.onend = () => { isRecording = false; voiceBtn.classList.remove('recording'); };
    }
  <\/script>
</body>
</html>`;
}

// Durable Object class for chat sessions
export class ChatSession {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: SessionState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessionState = {
      messages: [],
      topicsAttempted: {},
      difficulty: 'medium',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Load existing state if any
    const stored = await this.state.storage.get<SessionState>('state');
    if (stored) {
      this.sessionState = stored;
    }

    if (url.pathname === '/clear') {
      // Clear session data
      this.sessionState = {
        messages: [],
        topicsAttempted: {},
        difficulty: 'medium',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      await this.state.storage.put('state', this.sessionState);
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'GET') {
      // Return session state
      return new Response(JSON.stringify(this.sessionState), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Handle chat message
    const body = await request.json() as {
      message: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };

    const { message, difficulty } = body;

    // Update difficulty if provided
    if (difficulty) {
      this.sessionState.difficulty = difficulty;
    }

    // Detect topic from message
    const topic = this.detectTopic(message);
    if (topic) {
      if (!this.sessionState.topicsAttempted[topic]) {
        this.sessionState.topicsAttempted[topic] = {
          attempts: 0,
          hintsGiven: 0,
          solved: false,
          lastAttempt: Date.now(),
        };
      }
      this.sessionState.topicsAttempted[topic].attempts++;
      this.sessionState.topicsAttempted[topic].lastAttempt = Date.now();
      this.sessionState.currentProblem = topic;
    }

    // Add user message to history
    this.sessionState.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Build messages for AI
    const aiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.sessionState.messages.slice(-20).map(m => ({ // Keep last 20 messages for context
        role: m.role,
        content: m.content,
      })),
    ];

    // Get AI response
    try {
      const aiResponse = await this.env.AI.run(
        '@cf/meta/llama-3.3-70b-instruct',
        {
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 1024,
        }
      );

      const assistantMessage = aiResponse.response || 'I apologize, I could not generate a response.';

      // Add AI response to history
      this.sessionState.messages.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: Date.now(),
      });

      // Update last activity
      this.sessionState.lastActivity = Date.now();

      // Save state
      await this.state.storage.put('state', this.sessionState);

      // Prepare response with metadata
      const response = {
        reply: assistantMessage,
        sessionId: this.state.id.toString(),
        topicHints: this.sessionState.currentProblem ?
          this.sessionState.topicsAttempted[this.sessionState.currentProblem] : null,
        totalMessages: this.sessionState.messages.length,
        difficulty: this.sessionState.difficulty,
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (error) {
      console.error('AI error:', error);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  }

  // Simple topic detection
  private detectTopic(message: string): string | null {
    const topics = [
      'linked list', 'array', 'tree', 'binary tree', 'bst',
      'graph', 'bfs', 'dfs', 'dynamic programming', 'dp',
      'sort', 'search', 'hash map', 'hash table', 'heap',
      'queue', 'stack', 'recursion', 'backtracking',
      'system design', 'api design', 'database', 'cache',
      'two pointers', 'sliding window', 'binary search',
      'merge sort', 'quick sort', 'heap sort',
    ];

    const lowerMsg = message.toLowerCase();
    for (const topic of topics) {
      if (lowerMsg.includes(topic)) {
        return topic;
      }
    }

    return 'general coding';
  }
}