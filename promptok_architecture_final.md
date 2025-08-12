# PromptOK — Finalized Architecture (Bootstrap: ~100 users; Path to Scale)

## 1) Detailed Architectural Design

### 1.1 High-Level Overview (Free-tier friendly; scale-ready)

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Extension                      │
│  (MV3: content script + background service worker + UI)      │
└───────────────▲───────────────────────────┬──────────────────┘
                │                           │
        Injected UI / DOM ops        Auth (Supabase) + API calls
                │                           │
                │                   ┌───────▼─────────────────────┐
                │                   │  Vercel (Next.js App)       │
                │                   │  - Edge Middleware (Auth)   │
                │                   │  - API Routes (Serverless)  │
                │                   │  - Web Dashboard (Next.js)  │
                │                   └───────┬─────────────────────┘
                │                           │
                │                   ┌───────▼─────────┐   ┌───────────────┐
                │                   │  Upstash Redis  │   │  LLM Providers │
                │                   │  (cache/limits) │   │ (OpenAI,      │
                │                   └───────┬─────────┘   │  Anthropic,   │
                │                           │             │  Google, etc.) │
                │                   ┌───────▼─────────┐   └──────┬────────┘
                │                   │  Supabase       │          │
                │                   │  (Auth + DB +   │<─────────┘
                │                   │   Storage + RLS)│
                │                   └─────────────────┘
```

- Hosting: Vercel (Next.js App Router). Web dashboard and all APIs in one project for simplicity/cost.
- Auth + DB: Supabase (Auth, Postgres, RLS; optional Storage for assets/logs).
- Cache/Rate limiting/Queues: Upstash Redis free tier (or Vercel KV if preferred).
- LLM Providers: Adapter-based orchestrator supporting OpenAI, Anthropic, Google, Grok, etc.
- Cost control: Bring-Your-Own-Key (BYOK) first; project-owned keys optional, guarded by quotas.

### 1.2 Chrome Extension (MV3)
- Content script: prompt input detection, non-intrusive UI overlay via Shadow DOM; site adapters per LLM UI.
- Background service worker: auth token lifecycle, API calls, rate limit awareness, cross-tab sync.
- Popup/Options pages: sign-in, provider preferences, BYOK management, privacy controls.
- Permissions: minimal host permissions; `storage`, `activeTab`, `scripting`; narrow `host_permissions` for supported sites.

Core flow (debounced):
1) Detect prompt field and typing via MutationObserver; debounce 400–600 ms.
2) Call `/api/prompts/analyze` with {prompt, site, user prefs}. Show multiple-choice disambiguation.
3) On user selections, call `/api/prompts/refine` iteratively until clarity threshold.
4) Finalize with `/api/prompts/finalize` → inject enriched prompt back into the input.
5) Store session metadata locally; persist server-side if user opts in.

### 1.3 Backend (Vercel + Supabase + Upstash)
- Next.js Routes: serverless functions (Node 18+) with Edge Middleware for lightweight auth checks.
- Supabase Auth: email/password or OAuth (Google/GitHub). Use JWT in extension; short-lived, auto-refresh.
- DB (Postgres): normalized schema with RLS for tenant isolation.
- Redis (Upstash): request dedupe, analysis cache (TTL), per-user quota counters, lightweight queues.

API surface (v1):
- POST `/api/v1/prompts/analyze` → returns ambiguities (multiple-choice) + confidence id.
- POST `/api/v1/prompts/refine` → returns next-step options or final.
- POST `/api/v1/prompts/finalize` → returns enriched prompt + formatting controls.
- GET `/api/v1/user/profile` | PATCH `/api/v1/user/preferences`
- GET `/api/v1/usage` (quota view); POST `/api/v1/usage/track` (server-trusted only)

LLM orchestrator (server-side):
- Provider adapters with a common interface: `enhance()`, `analyzeAmbiguity()`, `generateOptions()`.
- Selection policy: user preference > cost/latency > availability; failover and backoff.
- Token budgeting and safety (per-provider RPM/TPM); surface provider error details safely.

Caching:
- Key: `hash(prompt + normalizedPrefs + site + step)`. TTL 15–60 min.
- Cache hits skip provider calls; ensures responsiveness and cost control.

Rate limits and quotas:
- Sliding window per user (e.g., 60 req/hour) + per-IP burst limits.
- BYOK request limits tied to user’s provider when key is user-supplied.

### 1.4 Data Model (Supabase)

```sql
-- users via auth.users
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text default 'free',
  byok jsonb default null,             -- encrypted at rest via pgcrypto or KMS
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  site text,
  original_prompt text not null,
  final_prompt text,
  analysis jsonb,
  selections jsonb,
  language text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text,
  tokens_used int,
  provider text,
  created_at timestamptz default now()
);
```

Row-Level Security (RLS): enable on tables; policies `user_id = auth.uid()` for reads/writes.

### 1.5 Web Dashboard (Next.js)
- Routes: `/dashboard`, `/prompts`, `/settings`, `/analytics`.
- Features: session history (opt-in), template presets, BYOK manager, usage view, provider latency/cost stats.
- Styling: Tailwind/Chakra; deploy on same Vercel project.

### 1.6 Implementation Notes
- Language detection for non-English prompts; optional translation pass.
- Prompt chunking for very long inputs; merge strategy post-enhancement.
- Privacy mode: process minimal data; disable server persistence; local-only basic enhancement option.
- Observability: Sentry (frontend+server), Vercel Analytics, simple audit logs in DB.

### 1.7 Path to Scale (when >100 users)
- Split orchestrator into a separate service (Fly.io/Render) if cold starts a problem.
- Add durable queue (Upstash QStash) for long tasks; webhooks back to API.
- Introduce ClickHouse/BigQuery for analytics; move hot paths behind API gateway when needed.
- Horizontal scale via Vercel regions; Redis multi-region replicas; provider pool tuning.

---

## 2) Nuances to Address
- Cross-site DOM variability: maintain a versioned site adapter registry; ship adapter updates via extension updates; fallback to generic heuristics + ML-based element detection if selectors fail.
- CSP/Shadow DOM/iframes: use Shadow DOM isolation; avoid inline scripts; leverage `web_accessible_resources`; message passing instead of direct DOM script injection when blocked.
- Debounce and progressive disclosure: avoid decision fatigue; surface 3–4 options per ambiguity; provide “smart default”.
- BYOK security: never store provider keys in extension; store server-side encrypted; sign outbound provider calls on server only.
- Cost guardrails: cache aggressively; short-circuit small/obvious prompts client-side; batch refinements into a single LLM call when feasible.
- Accessibility: keyboard-first navigation; ARIA roles; high-contrast option.
- Internationalization: basic i18n scaffolding for the overlay and dashboard.

---

## 3) Edge Cases & Handling Strategies
- Site updates break selectors: try fallback selector chains, role-based queries, ML hints; telemetry to flag adapter failures; remote-kill switch to disable injection per-domain.
- Multiple prompt fields on page: prompt field disambiguation UI; remember user choice per domain.
- Model switches mid-session (e.g., GPT-4o → 3.5): detect and recompute constraints; re-run last step with adjusted context.
- Long prompts (>5k chars): chunk, summarize context, re-apply refinement per chunk; merge and normalize style at finalize.
- Non-English/code-heavy prompts: detect category; switch to code-focused refinement template; avoid unnecessary style/formality choices.
- API errors/429s: exponential backoff, provider failover; return cached suggestions; inform user non-blockingly.
- Offline/poor connectivity: local basic enhancement (rule-based); queue server calls until back online.
- Multi-tab/session sync: BroadcastChannel to sync enhancement state; sessionId scoping.
- Auth expiry: silent refresh with Supabase; UX toast if user action needed.
- Privacy-sensitive prompts: local-only mode; do not persist raw prompts server-side; hash for dedupe only.

---

## 4) Additional Considerations
- Compliance: user consent and deletion endpoints; clear ToS re: cross-site augmentation; respect target sites’ policies.
- Release/CI: GitHub Actions → build, lint, test, package extension (zip), upload to Chrome Web Store; Vercel deploy; Supabase migrations.
- Environment vars: provider keys (server), Supabase keys, Sentry DSN; store in Vercel/Supabase secrets.
- Minimal SDK: thin TypeScript client in extension for typed API calls and auth token handling.
- Analytics: per-feature adoption, adapter failure rates, provider latency/cost; privacy-preserving by default.

---

## 5) Selected Tech Summary (Bootstrap)
- Extension: MV3, TypeScript, Shadow DOM UI, MutationObserver.
- Backend: Next.js (Vercel), API routes, Edge Middleware.
- Auth/DB: Supabase (Auth + Postgres + RLS).
- Cache/Rate limiting: Upstash Redis; optional QStash later.
- Monitoring: Sentry + Vercel Analytics.
- LLM: Adapter-based orchestrator with BYOK support.

This design is optimized for ~100 users on free tiers while providing a clear upgrade path to higher scale without large refactors.
