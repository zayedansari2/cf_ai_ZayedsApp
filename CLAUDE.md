# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This project uses Cloudflare Wrangler for local development and deployment.

**Local Development:**
```bash
# Start the Pages dev server (serves frontend + proxies API routes)
npx wrangler pages dev -- npm run dev

# Alternative: Start just the Worker dev server
npx wrangler dev
```

**Deployment:**
```bash
# Deploy the Worker
npx wrangler deploy

# Deploy Pages (via CI or direct publish)
npx wrangler pages publish
```

**Configuration:**
- `wrangler.toml` - Worker bindings, Durable Object declarations, and AI binding
- Requires Cloudflare account with Workers AI and Durable Objects enabled

## Architecture Overview

This is a Cloudflare Edge Chat application composed of three layers:

**Frontend (Pages)**
- Single-page application served from `pages/index.html`
- Communicates with Worker via `fetch()` to `POST /api/chat`
- Manages session IDs in localStorage for conversation continuity

**Worker (Cloudflare Workers)**
- Entry point: `worker/index.ts`
- Receives chat requests, manages Durable Object lifecycle
- Calls Workers AI (`@cf/meta/llama-3.1-8b-instruct` or similar) via `env.AI.run()`
- Returns JSON response with assistant's reply

**State Layer (Durable Objects)**
- One Durable Object instance per session ID
- Stores conversation history in memory (hundreds of KB per instance)
- Persists across requests; automatically hibernates when idle
- Loaded on-demand by the Worker using `env.CHAT_SESSIONS.get(id)`

## Data Flow

1. Frontend sends `POST /api/chat` with `{sessionId, message}`
2. Worker derives Durable Object ID from `sessionId` using `idFromName()`
3. Worker fetches the Durable Object instance, retrieves history
4. Worker calls Workers AI with the full conversation history
5. AI returns completion; Worker appends to history and stores back in DO
6. Worker returns `{reply, sessionId}` to frontend

## Key Files

- `worker/index.ts` - API routes, AI calls, Durable Object coordination
- `pages/index.html` - Chat UI and API client
- `wrangler.toml` - AI binding, Durable Object binding, migrations
- `IMPLEMENTATION.md` - Detailed architecture and design rationale
- `PROMPTS.md` - System prompts and prompt engineering strategy

## Configuration Requirements

Wrangler.toml must declare:
- `[ai]` binding for Workers AI access
- `[[durable_objects]]` namespace with `class_name = "ChatSession"`
- `[[migrations]]` for Durable Object schema updates
