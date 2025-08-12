# PromptOK — Final Architecture v2 (Bootstrap-ready + Suggestions Incorporated)

## 1) Detailed Architectural Design

### 1.1 High-Level Overview (free-tier first, scale later)
```
┌────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension (MV3)                       │
│ Content Script + Background SW + Shadow DOM UI + Offline Engine     │
└───────────────▲───────────────────────────┬─────────────────────────┘
                │                           │
        Injected UI / DOM ops        Auth (Supabase) + API calls
                │                           │
                │                   ┌───────▼──────────────────────┐
                │                   │  Vercel (Next.js App)        │
                │                   │  - Edge Middleware (Auth)    │
                │                   │  - API Routes (Edge/Node)    │
                │                   │  - SSE Streaming (analyze)   │
                │                   │  - Web Dashboard (Next.js)   │
                │                   └───────┬──────────────────────┘
                │                           │
                │                   ┌───────▼─────────┐   ┌──────────────┐
                │                   │  Upstash Redis  │   │ LLM Providers │
                │                   │ (cache/limits)  │   │ (OpenAI, ... )│
                │                   └───────┬─────────┘   └──────┬───────┘
                │                           │                   │
                │                   ┌───────▼─────────┐        │
                │                   │  Supabase       │<───────┘
                │                   │ (Auth + DB +    │
                │                   │  Storage + RLS) │
                │                   └─────────────────┘
                │
                │ (Optional fallback for availability)
                │
                └──────────────► Cloudflare Workers (free)
                                  - Minimal /health and /analyze-lite (BYOK only)
```
- Primary stack: Vercel (Next.js), Supabase (Auth/DB/RLS), Upstash Redis. All free-tier friendly.
- Optional availability fallback: a tiny Cloudflare Worker for health + a minimal BYOK-only analyze-lite endpoint if Vercel is down. Extension can route to fallback automatically when primary fails. No project keys used on fallback.

### 1.2 Extension Architecture
- Detection: Hybrid approach
  - Selector-based + Behavior-based (focus/typing, nearby submit) + fallback heuristics; upgrade path to ML-assisted hints.
- UI: Progressive enhancement
  - Start with 3–4 smart defaults; progressively disclose further options if confidence < threshold.
- Remote Site Adapters
  - Load adapter configs from API at startup and periodically (TTL with ETag). Local cache with versioning; remote kill switch per domain.
- Background SW
  - Auth token lifecycle, API calls, rate limiting awareness, cross-tab sync, offline queue.
- Offline-first Enhancer
  - Rule-based local improvement when offline/back-end down; provide “Privacy Mode” (local-only basic enhancement).
- Last-resort BYOK direct calls
  - If backend unavailable and user has BYOK, allow direct provider call from extension for analyze-lite. Never use project keys in the extension.

### 1.3 Backend API (Vercel)
- Edge Middleware for lightweight auth and routing decisions.
- Edge Runtime endpoints where possible for low latency and cold start mitigation:
  - `/api/v1/prompts/analyze` (Edge + SSE stream when supported by provider)
  - `/api/v1/site-adapters/latest` (Edge)
- Node Runtime endpoints for provider SDKs that require Node:
  - `/api/v1/prompts/refine`, `/api/v1/prompts/finalize`, `/api/v1/usage`, etc.
- Streaming (SSE) support for analyze to improve perceived latency; progressively send ambiguities/options as they are generated.

API surface (v1):
- POST `/api/v1/prompts/analyze` → SSE stream: {type: analysis_start|option|complete}
- POST `/api/v1/prompts/refine` → refined options or final
- POST `/api/v1/prompts/finalize` → enriched prompt with controls
- GET `/api/v1/site-adapters/latest` → signed JSON of latest active adapters
- GET `/api/v1/user/profile`, PATCH `/api/v1/user/preferences`
- GET `/api/v1/usage` (quota view)
- GET `/api/health` → overall system status for extension routing

### 1.4 LLM Orchestrator
- Provider adapters: OpenAI, Anthropic, Google, Grok, etc. Common interface: `analyzeAmbiguity`, `generateOptions`, `enhance`.
- Hybrid BYOK Model:
  - Default: small free tier using project keys (strict quotas, conservative models)
  - BYOK: power users bring keys for higher limits and choice; keys stored server-side encrypted
- Circuit Breaker + Failover:
  - Track provider failures; open/half-open/closed states; auto-failover to next provider
- Rate/Token Budgeting:
  - Per-provider RPM/TPM + user quotas, enforced via Redis counters
- Semantic Caching:
  - Phase 1: hash + Levenshtein/Jaccard similarity; Phase 2: embeddings (pgvector) when needed

### 1.5 Data Model (Supabase)
```sql
-- Existing tables (from v1): user_profiles, prompt_sessions, usage_logs

-- Templates for reusability and product insights
create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  template jsonb not null,
  usage_count int default 0,
  created_by uuid references auth.users(id),
  is_public boolean default false,
  created_at timestamptz default now()
);

-- Remote site adapter configuration & versioning
create table if not exists site_adapters (
  id uuid primary key default gen_random_uuid(),
  site_domain text not null,
  version text not null,
  selectors jsonb not null,
  fallback_selectors jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(site_domain, version)
);

-- Fine-grained enhancement analytics (optional)
create table if not exists enhancement_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references prompt_sessions(id),
  step_number int,
  choices_presented jsonb,
  user_selection jsonb,
  time_to_select interval,
  confidence_score decimal(3,2),
  created_at timestamptz default now()
);
```
- RLS: enabled; policies `user_id = auth.uid()`.
- Secrets: BYOK encrypted at rest (pgcrypto or KMS); rotation support.

### 1.6 Dashboard (Next.js)
- Routes: `/dashboard`, `/prompts`, `/settings`, `/analytics`.
- Features: template library, usage view, provider choice/latency, BYOK manager.
- Status & Health: show current provider health, system status; link to public status page.

### 1.7 Reliability/Availability
- Health checks: `/api/health` (Vercel) + Cloudflare Worker `/health`.
- Status page: Instatus (free) or UptimeRobot for heartbeat monitoring.
- Vercel Cron: pre-warm critical functions and rotate cache keys.

### 1.8 Cost Controls
- Aggressive caching; batch refinement when feasible.
- Free tier quotas; backpressure UI when limits near.
- Lightweight models by default; allow user to opt into premium via BYOK.

---

## 2) Nuances to Address
- Cross-site DOM variability: hybrid detection; remote adapter configs with quick rollout; per-domain kill switch.
- CSP/Shadow DOM/iframes: Shadow DOM isolation; avoid inline scripts; use `web_accessible_resources` + message passing.
- Progressive UI: start minimal, expand on demand; surfacing “smart defaults” with LLM-assisted preselect.
- Streaming UX: show options progressively to reduce perceived latency.
- Privacy modes: local-only option; hashed prompt dedupe; do not persist raw prompts unless user opts in.
- BYOK security: never store keys in extension; server-side encryption; only used on server or last-resort direct calls initiated by user.
- Single platform risk: optional Cloudflare Worker fallback + offline enhancer + BYOK direct path.
- Cold starts: Edge runtime for analyze; cron pre-warm; keep provider SDK usage minimal on edge.
- Redis limits: Upstash (HTTP-based) suitable for serverless; degrade gracefully to no-cache if thresholds reached.

---

## 3) Edge Cases & Handling Strategies
- Site updates break adapters: fallback selectors; behavior-based detection; telemetry to flag; remote update within minutes.
- Multiple prompt fields: ask user to pick field; remember per-domain.
- Model switch mid-session: detect; recompute constraints; re-run last step.
- Very long prompts: chunk + summarize + merge on finalize.
- Non-English/code prompts: classify and switch to category strategy; reduce style prompts for code.
- 429/5xx from providers: circuit breaker + failover; use cached suggestions; transparent user notice.
- Backend outage: route to Cloudflare Worker analyze-lite (BYOK only) or offline enhancer.
- Auth expiry: silent refresh; toast only when action required.
- Multi-tab conflicts: BroadcastChannel sync; session-scoped state.

---

## 4) Anything Else
- CI/CD: GitHub Actions for build, test, package extension, deploy to Vercel, run Supabase migrations.
- Feature flags: remote flags to stage new adapters and flows safely.
- Telemetry: privacy-preserving metrics on adapter success rate, latency, option selection funnels.
- Documentation: clear ToS, privacy policy, opt-in analytics disclosure.

---

## 5) Bootstrap vs Scale Plan
- Bootstrap (~100 users): Vercel + Supabase + Upstash, Edge analyze SSE, remote adapters, hybrid BYOK, offline enhancer.
- Scale: move orchestrator to dedicated service if needed, add durable queues (QStash), introduce pgvector/ClickHouse for similarity/analytics, add regional deployments and provider pool tuning.
