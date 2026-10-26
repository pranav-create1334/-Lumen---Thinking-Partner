# AI Chat — Gemini-powered assistant (Next.js)

A ChatGPT-style AI chat application built with the Next.js App Router, Google's
Gemini API (official `@google/genai` SDK), Tailwind CSS, and PostgreSQL via
Drizzle ORM — with a documented browser-storage fallback when no database is
configured.

**All AI responses come from the real Gemini API.** Nothing is simulated,
hardcoded, or faked in the production chat flow. (Automated tests mock the
SDK so they never consume quota.)

---

## 1. Quick start

```bash
npm install
```

1. Copy `.env.example` to `.env.local` **(create/edit the file yourself — it is never auto-overwritten)**.
2. Paste your free API key from https://aistudio.google.com/apikey into `GEMINI_API_KEY`.
3. Run:

```bash
npm run dev
```

Open http://localhost:3000. That's it — chat works without any database
(local-only history mode; see section 5).

## 2. `.env.local` reference

```ini
# Required — server-side only, never exposed to the browser
GEMINI_API_KEY=replace_with_your_gemini_api_key

# Optional — default: gemini-3.5-flash (must be a model your key can access)
GEMINI_MODEL=gemini-3.5-flash

# Optional — max output tokens per response (default 2048)
# GEMINI_MAX_OUTPUT_TOKENS=2048

# Optional — PostgreSQL. If set, chat history is stored server-side.
# If omitted, the app runs in documented local-only mode (browser localStorage).
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_chat
```

Never commit `.env.local`. The key stays on the server; no `NEXT_PUBLIC_`
variables are used for secrets.

## 3. PostgreSQL setup (optional but recommended)

```bash
# Option A: Docker (creates db `ai_chat`, user `postgres`, password `postgres`)
docker compose up -d

# Then point DATABASE_URL at it and apply migrations:

npm run db:migrate     # applies drizzle/*.sql migrations

# Alternatives:
npm run db:generate    # regenerate migrations after editing lib/db/schema.ts
npm run db:push        # quick dev sync (skips migration files)
```

When `DATABASE_URL` is set, conversations and messages persist in PostgreSQL
(cascade delete, indexed by conversation + time), and the sidebar badge
switches to “PostgreSQL history”.

## 4. Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Run the app locally (http://localhost:3000) |
| `npm run build`     | Production build                        |
| `npm start`         | Serve the production build              |
| `npm test`          | Unit tests (Vitest)                     |
| `npm run test:watch`| Watch-mode tests                        |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | TypeScript strict check                 |
| `npm run db:migrate`| Apply database migrations               |

## 5. Storage modes

- **Database mode** (`DATABASE_URL` set): the server is the source of truth.
  The client sends only the conversation id + new message; the server loads
  authoritative context, persists the user turn at send time, and persists the
  assistant turn only after a successful stream. Partial/failed/aborted
  responses are never stored. Retried sends with an identical last user
  message are not duplicated.
- **Local-only mode** (no `DATABASE_URL`): history lives in
  `localStorage` **in this browser on this device only**; the sidebar badge
  and API responses both say so explicitly (routes return `501 LOCAL_ONLY_MODE`
  rather than pretending data is saved server-side). Sending still uses the
  same real Gemini streaming endpoint.

## 6. API surface

| Route                        | Method            | Purpose |
| ---------------------------- | ----------------- | ------- |
| `/api/chat`                  | POST              | Create/continue a conversation, stream Gemini response as NDJSON (`meta` → `delta*` → `done`\|`aborted`\|`error`) |
| `/api/conversations`         | GET               | List saved conversations (db mode) |
| `/api/conversations/[id]`    | GET/PATCH/DELETE  | Fetch, rename, delete |
| `/api/config`                | GET               | Public runtime config (mode, model, limits — no secrets) |

All request bodies validated with Zod; max message length 6000 chars;
rate limit ~20 requests / 5 min per IP (in-memory, fixed window).

## 7. UI actions

New chat · load/open conversation (restored after refresh via `?c=<id>`) ·
rename (inline dialog) · delete (confirmation dialog, cascades) · search chats ·
copy response (copies readable text, not markdown source) · regenerate last
answer · retry failed sends (composer text preserved; server de-duplicates) ·
stop generation (partial kept visually, never persisted) · scroll-to-latest ·
light/dark theme (persisted) · responsive sidebar ↔ mobile drawer.

## 8. Documented limitations (college-project scope)

- **Single-user**: no accounts, no auth. History is shared in database mode.
  Public deployment would require authentication, per-user isolation, and
  abuse prevention before exposing paid API usage.
- Rate limiting is in-memory per server process (fine for local dev).
- Context window policy: last 24 turns per conversation; no cross-conversation
  memory or summarization.
- Upstream cancellation: the client abort propagates to the Gemini SDK via
  `config.abortSignal` where supported; the stream always stops client-side and
  partial output is never persisted either way.
- Syntax highlighting is applied with highlight.js locally; raw HTML in AI
  output is never rendered (react-markdown default sanitization).

## 9. Project structure (abbreviated)

```
app/                      App Router: page + API routes
  api/chat/route.ts       streaming Gemini endpoint (NDJSON)
  api/conversations/…     history CRUD + detail
  api/config/route.ts     public runtime config
components/
  chat/                   sidebar, composer, bubbles, markdown, code block, empty state
  ui/                     shadcn-style primitives (button, input, textarea, dialog, dropdown)
lib/
  ai/gemini.ts            Gemini integration (streaming, system prompt, error mapping)
  api/                    error helpers
  chat/                   shared helpers (title, NDJSON parser, markdown→text)
  db/                     drizzle client + schema + repository queries
  hooks/                  use-chat-app (all client state/actions), use-theme
  local/                  localStorage fallback + repository classes
  validation/             Zod schemas
drizzle/                  generated SQL migrations
types/                    shared TypeScript types
```
