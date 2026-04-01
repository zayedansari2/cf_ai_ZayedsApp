export interface Env {
  AI: any;
  CHAT_SESSIONS: DurableObjectNamespace;
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

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

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

    const response = await session.fetch('/clear', {
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