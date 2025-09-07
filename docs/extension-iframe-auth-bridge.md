# PromptOK Extension – Secure Iframe Auth Bridge Plan (Read First)

This document describes the design and step‑by‑step rollout to replace Supabase token usage in the Chrome extension with a secure iframe + postMessage bridge that mint short‑lived JWTs from the PromptOK web app.

Production domain: https://prompt-ok.vercel.app/
Extension ID (dev): agoffikldhbnplphjknagiacideikboj
Extension ID (prod): <TBD – add when publishing>
JWT lifetime: 5 minutes
Scope: ["enhance"] (initial)

## Goals
- Replace extension’s current Supabase access_token handling with short‑lived, server‑signed JWTs.
- Prevent exposing long‑lived tokens to the extension.
- Keep session authority on the web app via httpOnly Supabase cookies.
- Strong origin/CSP controls to ensure only our extension can frame the bridge page.

## High-Level Flow
1. Extension creates an offscreen document (MV3), which embeds a hidden iframe at:
   - https://prompt-ok.vercel.app/extension-auth/bridge?parentOrigin=chrome-extension://<your-extension-id>
2. The iframe runs on our domain, has access to session cookies, and calls the backend:
   - GET /api/extension-token
3. If the user is logged in and active:
   - Backend returns a short‑lived JWT (5 min), with scope = ["enhance"].
   - The iframe immediately postMessages the token to its parent using the precise `targetOrigin` it received (`parentOrigin`), never `*`.
4. The offscreen document validates `e.origin === "https://prompt-ok.vercel.app"` and that the message.type matches the expected constant, then stores the JWT in `chrome.storage.local` as `extension_jwt` with `expiresAt`, and refreshes it proactively (e.g., T-60s).
5. Content scripts and popup request the JWT from background (message `GET_EXTENSION_JWT`) and use it for backend calls (e.g., `Authorization: Bearer <jwt>` to `/api/extension/enhance`).

## Server Additions

### 1) Route: `/api/extension-token` (New)
- Purpose: If session cookie represents a valid, active user, issue a 5‑min JWT.
- Auth Source: Supabase SSR via cookies (no headers from extension).
- Response:
  - 200 OK `{ jwt: string, expiresAt: number, scope: string[], iss: string, aud: string, sub: string, iat: number, exp: number, jti: string, token_version?: number }`
  - 200 OK `{ loggedIn: false }` if no valid session
- Security:
  - Uses existing `securityMiddleware` with `rateLimitType: 'auth-sensitive'`, `skipRateLimit: false`.
  - No CSRF required; it’s a GET from same‑origin iframe.
  - Signed with `EXTENSION_JWT_SECRET` (new env var) using HS256. Optionally support RS256 (see Security Notes).
- Claims include: `iss` (issuer, e.g. `https://prompt-ok.vercel.app`), `aud` (audience, e.g. `promptok-extension`), `sub` (user id), `scope` (e.g., ["enhance"]), `iat`, `exp`, `jti` (unique id). Optionally include `token_version` (small int) for fast global invalidation.
- Edge cases:
  - If profile is deactivated or soft‑deleted, return `{ loggedIn: false }`.

### 2) Page: `/extension-auth/bridge` (New)
- Minimal HTML + inline JS:
  - Reads `parentOrigin` from query string (required) and validates it matches the expected chrome-extension:// scheme for known IDs.
  - Calls `/api/extension-token`.
  - Immediately `postMessage` to parent with `{ type: 'PROMPTOK_EXTENSION_TOKEN', payload: { jwt, expiresAt, scope, iss, aud, sub, iat, exp, jti, token_version } }` or `{ loggedIn: false }`, using `window.parent.postMessage(payload, parentOrigin)` (never `*`).
- Response headers (override defaults):
  - `X-Frame-Options`: (omit or set consistent with CSP; rely on CSP for modern browsers)
  - `Content-Security-Policy`:
    - `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' chrome-extension://agoffikldhbnplphjknagiacideikboj chrome-extension://<prod-id>;`
  - This allows only our site and our extension IDs (dev + prod) to embed the bridge.
- No third‑party scripts, no UI, no analytics. Keep it minimal.

Middleware/CSP note: The global `addSecurityHeaders()` currently sets `X-Frame-Options: DENY` and `frame-ancestors 'none'`. For this page, return a Response with the custom CSP headers directly and do not apply the global headers, or explicitly override them for this route.

### 3) Route: `/api/extension/enhance` (New)
- Purpose: Backend entry point for the extension to enhance prompts.
- Auth: Requires `Authorization: Bearer <short‑lived JWT>` from `/api/extension-token`.
- Validates JWT with `EXTENSION_JWT_SECRET`, checks `scope` contains `enhance`.
- For now: placeholder stub returning `{ ok: true, enhancedPrompt: "[placeholder] ..." }`.
- Later: wire to your internal enhancement service (Supabase Edge Function, internal service, etc.) server‑side.
- Security:
  - `securityMiddleware` with `rateLimitType: 'api'`.
  - No cookies needed from extension; only Bearer JWT.

## Extension Changes (MV3)

### A) Offscreen Document + Iframe
- On background startup, request offscreen document (e.g., `offscreen.html`).
- In the offscreen document’s JS:
  - Create an invisible iframe with `src = https://prompt-ok.vercel.app/extension-auth/bridge?parentOrigin=chrome-extension://<your-extension-id>`.
- Listen to `window.message` events.
- Validate `event.origin === 'https://prompt-ok.vercel.app'`.
- Store `{ jwt, expiresAt }` in `chrome.storage.local` as `extension_jwt`.
- Set a timer to refresh at T-60s by reloading the iframe or pinging the bridge endpoint. Consider a backoff and a single-flight guard to avoid thundering herd on service worker restarts.

### B) Messaging API (Background)
- Handle `GET_EXTENSION_JWT`:
  - Return `{ jwt, expiresAt }` if present and not expired.
  - If near expiry, trigger refresh and await new token (debounced) or return current and let caller retry.
  - Recommend storing only `{ jwt, expiresAt }` (no PII) and clearing on signout or error.

### C) Content Script / Popup Usage
- Replace all Supabase token usage and any calls to `/api/auth/*` from the extension.
- For enhancement flows:
  - Ask background for the short‑lived JWT.
  - Call `POST https://prompt-ok.vercel.app/api/extension/enhance` with `Authorization: Bearer <jwt>` and body `{ prompt, ... }`.
  - Handle 401 by requesting a fresh token.

### D) Remove Legacy Token Sync
- Remove `extension/website-sync.js` and `public/extension-sync.js` usage from the extension.
- Remove any runtime messaging that sets/gets Supabase tokens (`SET_TOKEN`, `GET_TOKEN`) from content scripts and popup.
- Keep background token update messages used exclusively for the new short‑lived JWT if needed (naming changes to avoid confusion).

## Security Model
- **Iframe origin enforcement**: Extension only trusts messages from `https://prompt-ok.vercel.app`.
- **Framing protection**: Bridge page sets `frame-ancestors 'self' chrome-extension://agoffikldhbnplphjknagiacideikboj chrome-extension://<prod-id>`.
- **Short‑lived credential**: 5‑minute JWT, scope‑constrained, no refresh tokens exposed to the extension.
- **Server‑side policy**: `/api/extension/enhance` validates JWT signature, scope, and expiry.
- **Rate limiting**: Existing `securityMiddleware` applied to both routes.

Additional hardening (recommended):
- JWT algorithm: HS256 is OK. Consider RS256 in the future for key separation and rotation (server signs with private key; verifier(s) use public key). If adopted, expose a JWKS endpoint for public keys and rotate periodically.
- Revocation: With 5‑minute TTL, revocation is usually unnecessary, but you may:
  - Include `token_version` in JWT and validate against user record; bump it to invalidate outstanding tokens.
  - Maintain a short-lived in-memory/DB blacklist of `jti` to immediately revoke specific tokens.
- Logging: Avoid logging raw prompts or JWTs. If needed for debugging, scrub/redact and make opt-in.

## Environment Variables
- `EXTENSION_JWT_SECRET` (Required, for HS256): random 32+ char secret. Store in Vercel/env secrets (not in git). Plan rotations.
- Optional (for RS256, future): `EXTENSION_JWT_PRIVATE_KEY`, `EXTENSION_JWT_PUBLIC_KEY` or a JWKS URL. Document key rotation if enabled.
- Uses existing Supabase envs already present.

## Rollout Plan (Phased, Confirm Each Step)

1) Server – Token & Bridge (Step 1)
- Add `/api/extension-token` to issue 5‑min JWT.
- Add `/extension-auth/bridge` page with strict headers + minimal script.
- No extension changes yet.

2) Server – Enhance Endpoint (Step 2)
- Add `/api/extension/enhance` that validates JWT and returns placeholder enhancement.
- Keep internal implementation TODO for now.

3) Extension – Offscreen & JWT Wiring (Step 3)
- Add offscreen document and iframe logic.
- Add `GET_EXTENSION_JWT` runtime handler.

4) Extension – Replace Token Usage (Step 4)
- Update content scripts/popup/background to stop using Supabase tokens.
- Point enhancement calls to `/api/extension/enhance` with Bearer JWT.

5) Remove Legacy Token Sync (Step 5)
- Remove `website-sync.js`, `public/extension-sync.js`, and old token messaging.
- Clean up manifest and any references.

6) QA & Security Validation (Step 6)
- Verify iframe loads only in offscreen document.
- Verify origin checks and CSP enforcement.
- Verify JWT expiry/refresh behavior.
- Verify rate limiting and error handling.

## API Contracts

### GET `/api/extension-token`
Response 200 (logged in):
```json
{
  "jwt": "<short-lived-jwt>",
  "expiresAt": 1725700000000,
  "scope": ["enhance"],
  "iss": "https://prompt-ok.vercel.app",
  "aud": "promptok-extension",
  "jti": "<uuid>",
  "token_version": 1
}
```
Response 200 (not logged in):
```json
{ "loggedIn": false }
```

### POST `/api/extension/enhance`
Request headers:
```
Authorization: Bearer <short-lived-jwt>
Content-Type: application/json
```
Request body (example):
```json
{ "prompt": "..." }
```
Response 200 (placeholder):
```json
{ "ok": true, "enhancedPrompt": "[placeholder] ..." }
```
Response 401 (invalid/expired token):
```json
{ "error": "UNAUTHORIZED" }
```

## File/Code Changes Summary (Ahead)
- Add: `app/api/extension-token/route.ts`
- Add: `app/extension-auth/bridge/page.tsx` (or `route.ts` serving HTML) with strict headers (override global `addSecurityHeaders`)
- Add: `app/api/extension/enhance/route.ts`
- Extension: add `offscreen.html` + `offscreen.js`, background wiring
- Extension: remove `website-sync.js`, stop referencing `public/extension-sync.js`
- Extension: refactor `enhanced-content.js` and `popup.js` to use `GET_EXTENSION_JWT`

## Open Confirmations (All addressed by user)
- Use offscreen document for iframe host: YES
- Provide `EXTENSION_JWT_SECRET` in env: YES (user will add)
- JWT lifetime: 5 minutes: YES
- JWT scope: ["enhance"]: YES (initial)
- Enhance endpoint strategy: Next.js `/api/extension/enhance`: YES
- Remove current token sync: YES

---

Once you confirm this plan, I will implement Step 1 (server: `/api/extension-token` and `/extension-auth/bridge`) and report back before proceeding to Step 2.
