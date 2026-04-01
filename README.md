# CodeSpar - AI Coding Interview Coach

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![Workers AI](https://img.shields.io/badge/Workers-AI-blue?style=flat-square&logo=openai)](https://ai.cloudflare.com/)
[![Durable Objects](https://img.shields.io/badge/Durable-Objects-green?style=flat-square)](https://developers.cloudflare.com/durable-objects/)

**CodeSpar** is an AI-powered coding interview preparation tool that uses the Socratic method to help users develop problem-solving skills. Instead of giving direct answers, CodeSpar asks guiding questions to help you discover solutions yourself.

## 🎯 Problem Solved

Traditional coding interview prep resources fall short in three ways:

1. **Static problem lists** - No interaction or personalized guidance
2. **Instant answer chatbots** - Give solutions immediately without building intuition
3. **No memory** - Don't track your struggles or progress across sessions

CodeSpar solves these by providing a conversational, Socratic learning experience with persistent memory of your progress.

## ✨ Features

- **🎤 Voice & Text Input** - Ask questions via voice or typing
- **🧠 Socratic Method** - Guided learning through questions, not answers
- **💾 Persistent Memory** - Conversation history and progress tracking via Durable Objects
- **📊 Progress Analytics** - Track topics attempted and practice frequency
- **🎚️ Difficulty Levels** - Easy, medium, and hard modes
- **💬 Modern Chat Interface** - Real-time messaging with syntax highlighting
- **🔊 Text-to-Speech** - Optional audio responses

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Platform                     │
├──────────────┬─────────────────────────┬──────────────────────┤
│   Pages      │       Workers          │   Durable Objects    │
│  (Frontend)  │      (API Layer)       │     (State Layer)    │
├──────────────┼─────────────────────────┼──────────────────────┤
│ index.html   │  /api/chat endpoint     │ Session state        │
│ Chat UI      │  AI.run() calls         │ Conversation history │
│ Voice input  │  CORS handling          │ Topic tracking       │
└──────────────┴─────────────────────────┴──────────────────────┘
                           │
                    Workers AI (Llama 3.3)
```

### Data Flow

1. User sends message (voice or text) via Pages frontend
2. Worker receives request, derives Durable Object ID from session
3. Durable Object loads conversation history and topic progress
4. Worker calls Workers AI with system prompt + history + current message
5. AI returns Socratic response (questions/hints, not direct answers)
6. Worker saves updated state to Durable Object
7. Response returned to frontend with progress metadata

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zayedansari2/cf_ai_ZayedsApp.git
   cd cf_ai_ZayedsApp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Authenticate with Cloudflare:**
   ```bash
   npx wrangler login
   ```

4. **Create KV namespace (optional, for extended features):**
   ```bash
   npx wrangler kv:namespace create "USER_METADATA"
   ```

5. **Start the development server:**
   ```bash
   # Option 1: Full local development with Durable Objects
   npx wrangler dev

   # Option 2: Pages dev server (recommended for full experience)
   npx wrangler pages dev -- npm run dev:static
   ```

6. **Open your browser:**
   Navigate to `http://localhost:8788`

### Deployment

Deploy to Cloudflare with a single command:

```bash
# Deploy the Worker
npx wrangler deploy

# The frontend (pages/index.html) is automatically included
```

The application will be available at your Worker URL (e.g., `https://cf-ai-zayedsapp.your-account.workers.dev`)

### CI/CD

This repository is configured with GitHub Actions for automatic deployment:

1. Push to `main` branch triggers deployment
2. Cloudflare Workers are updated automatically
3. Pages are deployed via the Worker site binding

## 📁 Project Structure

```
cf_ai_ZayedsApp/
├── .gitignore                 # Git ignore rules
├── package.json               # Node dependencies and scripts
├── README.md                  # This file
├── PROMPTS.md                 # AI prompts documentation
├── IMPLEMENTATION.md          # Detailed architecture docs
├── wrangler.toml              # Cloudflare configuration
├── worker/
│   └── index.ts              # Worker API and Durable Object
└── pages/
    └── index.html            # Frontend chat application
```

## 🎮 Usage

### Starting a Session

1. Open the application in your browser
2. A session ID is automatically generated (stored in localStorage)
3. Select your preferred difficulty level (Easy/Medium/Hard)
4. Start asking coding questions!

### Sample Questions

Try asking CodeSpar about:

- "How do I reverse a linked list?"
- "Explain binary search"
- "Design a rate limiter for an API"
- "What's the time complexity of merge sort?"
- "Two pointers technique explained"

### Socratic Learning Flow

**User:** "How do I reverse a linked list?"

**CodeSpar:** "Before diving into code, let's think about this step by step. When reversing a linked list, what are the three key pieces of information you need to track as you iterate through the nodes? Consider: what happens to each node's `next` pointer?"

**User:** "I need to track the previous node?"

**CodeSpar:** "Exactly! You need three pointers: previous, current, and next. Now, can you describe in pseudocode what happens in each iteration of the loop?"

### Voice Input

- Click the microphone button to enable voice input
- Speak your question clearly
- The Web Speech API will transcribe your speech to text
- Works in Chrome, Edge, and Safari

## 🔧 Configuration

### Environment Variables

Set these via `wrangler secret put`:

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `development` or `production` |

### Wrangler.toml Settings

Key configurations in `wrangler.toml`:

```toml
[ai]
binding = "AI"  # Workers AI binding

[[durable_objects.bindings]]
name = "CHAT_SESSIONS"
class_name = "ChatSession"
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Send text message and receive Socratic response
- [ ] Use voice input (if browser supports it)
- [ ] Verify conversation history persists after refresh
- [ ] Check topic tracking in sidebar
- [ ] Test difficulty level switching
- [ ] Verify session clearing works
- [ ] Test code syntax highlighting

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/chat` | POST | Send message to AI coach |
| `/api/session/:id` | GET | Get session history |
| `/api/clear` | POST | Clear session data |

## 📝 AI Prompts

See [PROMPTS.md](./PROMPTS.md) for the complete system prompt and rationale behind the Socratic teaching approach.

## 🔒 Privacy & Security

- Session data is stored in Durable Objects, isolated per session ID
- No personal information is collected or stored
- Conversation history persists only for the session duration
- Session IDs are randomly generated and stored locally

## 🤝 Contributing

This project was built for the Cloudflare AI fast-track assignment. AI-assisted coding was used during development - see PROMPTS.md for the prompts used.

## 📄 License

MIT License - feel free to use this project for learning and inspiration!

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge compute platform
- [Workers AI](https://ai.cloudflare.com/) - Llama 3.3 model hosting
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) - Persistent state
- [highlight.js](https://highlightjs.org/) - Code syntax highlighting

---

**Live Demo:** [https://proud-snowflake-79c1.zayedansari112.workers.dev/](https://proud-snowflake-79c1.zayedansari112.workers.dev/)

Built with ❤️ using Cloudflare Workers AI and the Socratic method.