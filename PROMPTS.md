# AI Prompts Documentation

This document contains all AI prompts used in the CodeSpar application, along with the rationale behind each design decision.

## Table of Contents

- [System Prompt](#system-prompt)
- [Prompt Engineering Strategy](#prompt-engineering-strategy)
- [AI Prompts Used During Development](#ai-prompts-used-during-development)

---

## System Prompt

**Location:** `worker/index.ts`

**Purpose:** Defines the personality and behavior of the AI coding interview coach.

```typescript
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
```

### Rationale

This prompt was designed with the following goals:

1. **Socratic Method Emphasis:** The prompt explicitly instructs the AI to use the Socratic method - asking questions rather than giving answers. This builds problem-solving intuition.

2. **Progressive Disclosure:** The "3+ attempts" rule ensures users get hints when truly stuck, preventing frustration while maintaining the learning value.

3. **Encouragement:** The AI is instructed to be "encouraging and patient" - interview prep can be stressful, so the tone matters.

4. **Comprehensive Coverage:** Listing specific topics helps the AI understand the scope and respond appropriately to domain-specific questions.

5. **Practical Guidance:** Instructions like "guide toward writing pseudocode" ensure the AI focuses on process, not just end results.

---

## Prompt Engineering Strategy

### 1. Conversation Context Management

**Approach:** We maintain the last 20 messages in the context window to balance between:
- Having enough context for coherent conversation
- Staying within token limits (especially important for Llama 3.3)

**Implementation:**
```typescript
const aiMessages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...this.sessionState.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content,
  })),
];
```

### 2. Temperature Setting

**Value:** 0.7

**Rationale:** 
- Lower temperatures (e.g., 0.2) would make responses too deterministic and potentially boring
- Higher temperatures (e.g., 1.0) might produce erratic or off-topic responses
- 0.7 strikes a balance: creative enough for varied Socratic questions, consistent enough for reliable coaching

### 3. Max Tokens

**Value:** 1024

**Rationale:**
- Coding explanations can be verbose
- Provides enough room for detailed Socratic questioning
- Prevents excessively long responses that might overwhelm users

---

## AI Prompts Used During Development

These are the prompts used to build this application with AI assistance:

### Prompt 1: Architecture Design

**Context:** Initial planning phase
**Prompt:** 
```
I need to build a coding interview prep application using Cloudflare Workers AI.

Requirements:
- Use Llama 3.3 on Workers AI
- Use Durable Objects for state/memory
- Single-page frontend on Cloudflare Pages
- Voice input capability
- Socratic teaching method (don't give direct answers)
- Topic tracking across sessions

Design the architecture including:
1. Data flow from user input to AI response
2. State structure for Durable Objects
3. API endpoints needed
4. Frontend components
```

**Outcome:** Informed the overall architecture documented in IMPLEMENTATION.md

---

### Prompt 2: System Prompt Design

**Context:** Creating the AI personality
**Prompt:**
```
Write a system prompt for an AI coding interview coach that:
1. Uses the Socratic method (asking questions instead of giving answers)
2. Never gives complete solutions immediately
3. Is encouraging and patient
4. Guides users through problem-solving step by step
5. Covers data structures, algorithms, and system design
6. Asks about edge cases and complexity
7. Celebrates small wins

The AI should help users develop problem-solving intuition, not just memorized answers.
```

**Outcome:** The SYSTEM_PROMPT used in `worker/index.ts`

---

### Prompt 3: Durable Object State Design

**Context:** Designing data persistence
**Prompt:**
```
Design the TypeScript interface for a Durable Object state that tracks:
1. Conversation history (role, content, timestamp)
2. Topics the user has attempted (with attempt counts, hints given, solved status)
3. Current problem being worked on
4. Difficulty level preference
5. Session creation and last activity timestamps

Also include:
- How to detect topics from user messages
- How to update topic statistics
- When to save state to storage
```

**Outcome:** The `SessionState` interface and topic detection logic in `worker/index.ts`

---

### Prompt 4: Frontend Chat UI

**Context:** Building the user interface
**Prompt:**
```
Create a modern chat interface in HTML/CSS/JS for a coding interview coach:

Requirements:
- Dark theme with good code visibility
- Message bubbles for user and assistant
- Auto-resizing text input
- Voice input button (Web Speech API)
- Syntax highlighting for code blocks
- Typing indicator animation
- Session ID display
- Difficulty selector (Easy/Medium/Hard)
- Topic tracking sidebar
- Responsive design

Use highlight.js for code syntax highlighting.
```

**Outcome:** The `pages/index.html` file

---

### Prompt 5: Voice Integration

**Context:** Adding voice input capability
**Prompt:**
```
Implement voice input using the Web Speech API:

1. Check if browser supports SpeechRecognition
2. Create recognition instance with settings:
   - Language: en-US
   - Continuous: false
   - Interim results: true
3. Handle start/stop with visual feedback (recording state)
4. Update textarea with transcribed text
5. Handle errors gracefully
6. Provide fallback for unsupported browsers

Include a microphone button with recording animation.
```

**Outcome:** Voice input implementation in `pages/index.html`

---

### Prompt 6: Topic Detection

**Context:** Implementing progress tracking
**Prompt:**
```
Write a function to detect coding topics from user messages:

Topics to detect:
- Data structures: linked list, array, tree, binary tree, graph, hash map, heap, queue, stack
- Algorithms: sort, search, bfs, dfs, dynamic programming, recursion, backtracking
- Techniques: two pointers, sliding window, binary search
- Concepts: time complexity, space complexity
- System design: api design, database, cache, load balancing

Return the matched topic or null if no match.
```

**Outcome:** The `detectTopic()` method in the `ChatSession` class

---

### Prompt 7: CORS and API Design

**Context:** Ensuring frontend-backend communication
**Prompt:**
```
Design API endpoints for a coding interview coach:

Endpoints needed:
1. POST /api/chat - Send message, get AI response
2. GET /api/session/:id - Get conversation history
3. POST /api/clear - Clear session data
4. GET /api/health - Health check

Include:
- CORS headers for cross-origin requests
- JSON request/response handling
- Error handling with appropriate status codes
- Request validation
```

**Outcome:** API implementation in `worker/index.ts`

---

### Prompt 8: Documentation

**Context:** Creating project documentation
**Prompt:**
```
Write a comprehensive README.md for a coding interview coach application with:

1. Clear description of the problem it solves
2. Feature list with emojis
3. Architecture diagram (text-based)
4. Installation instructions
5. Local development guide
6. Deployment instructions
7. API endpoint documentation
8. Usage examples
9. Technology stack badges

Target audience: Technical recruiters and developers evaluating the project.
```

**Outcome:** The `README.md` file

---

## Summary

The prompts used in this project were designed to:

1. **Maximize Learning:** By using the Socratic method, users develop problem-solving skills rather than memorizing solutions

2. **Maintain State:** Durable Objects enable truly conversational experiences with memory across sessions

3. **Be Accessible:** Voice input and clear UI make the tool usable in various contexts

4. **Track Progress:** Topic detection and statistics help users see their improvement over time

5. **Follow Best Practices:** CORS handling, error management, and responsive design ensure a production-quality application

---

## Attribution

This application was built using AI-assisted coding. The following AI models were used:

- **Claude (Anthropic)** - Architecture design, code generation, documentation
- **Llama 3.3 (Meta)** - Runtime AI responses in the application

All AI prompts used during development are documented above for transparency and reproducibility.