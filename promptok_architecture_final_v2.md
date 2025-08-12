# PromptOK — Minimal Bootstrap Architecture (100 users, essential MVP)

## 1) Core Architecture (Remove the Bloat)

### 1.1 Simplified System Design
```
┌─────────────────────────────────────┐
│        Chrome Extension             │
│   Content Script + Background SW    │
└──────────────┬──────────────────────┘
               │
               │ REST API calls
               │
        ┌──────▼──────────────────┐
        │   Vercel (Next.js)      │
        │   - API Routes only     │
        │   - Simple dashboard    │
        └──────┬──────────────────┘
               │
        ┌──────▼─────────┐   ┌────────────┐
        │  Upstash Redis │   │ OpenAI API │
        │  (cache only)  │   │ (primary)  │
        └──────┬─────────┘   └────────────┘
               │
        ┌──────▼─────────┐
        │   Supabase     │
        │ (Auth + DB)    │
        └────────────────┘
```

**What we REMOVED:**
- ❌ Cloudflare Worker fallback (unnecessary complexity)
- ❌ SSE streaming (adds complexity, marginal UX benefit)
- ❌ Circuit breakers (over-engineering for 100 users)
- ❌ Multiple LLM providers (start with OpenAI only)
- ❌ Offline enhancement (nice-to-have, not essential)
- ❌ Semantic caching (basic hash caching is fine)
- ❌ Complex progressive UI (simple works)

### 1.2 Chrome Extension (Simplified)

**Core files:**
```
├── manifest.json
├── content.js (prompt detection + UI injection)
├── background.js (API calls + auth)
├── popup.html (login only)
└── overlay.css (simple styling)
```

**Essential functionality:**
1. Simple prompt detection: Look for common selectors + `textarea` with submit nearby
2. Basic UI overlay: Show 3-4 multiple choice questions max
3. Single API call: Send prompt → get enhanced prompt back
4. No complex state management: Keep it stateless

```javascript
// Simplified content script
class SimplePromptDetector {
  detect() {
    // Basic selectors that work on most LLM sites
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="prompt" i]',
      '[contenteditable="true"]'
    ];
    return document.querySelector(selectors.join(', '));
  }
}

// Simple overlay UI
function showEnhancementOptions(options) {
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div class="promptok-overlay">
      <h4>Clarify your prompt:</h4>
      ${options.map(opt => `
        <label>
          <input type="radio" name="choice" value="${opt.value}">
          ${opt.label}
        </label>
      `).join('')}
      <button onclick="enhancePrompt()">Enhance</button>
    </div>
  `;
  document.body.appendChild(overlay);
}
```

### 1.3 Backend API (Minimal)

**Essential endpoints only:**
- `POST /api/analyze` - Single endpoint that does everything
- `GET /api/auth/user` - Get user info
- `POST /api/auth/login` - Simple email/password

```javascript
// Single analyze endpoint
export async function POST(request) {
  const { prompt, site } = await request.json();
  
  // Simple LLM call to OpenAI
  const analysis = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{
      role: "system",
      content: `Analyze this prompt for ambiguity. Return 3 multiple choice questions to clarify intent. Format as JSON with questions and options.`
    }, {
      role: "user", 
      content: prompt
    }]
  });

  // Cache the result
  await redis.set(`analysis:${hash(prompt)}`, analysis, 'EX', 900);
  
  return Response.json(analysis);
}
```

### 1.4 Database (Bare Minimum)

```sql
-- Just essential tables
create table user_profiles (
  id uuid primary key references auth.users(id),
  plan text default 'free',
  usage_count int default 0,
  created_at timestamptz default now()
);

create table prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  original_prompt text,
  enhanced_prompt text,
  site text,
  created_at timestamptz default now()
);
```

That's it. No templates, no metrics, no adapters table.

### 1.5 What We Keep Simple

**Authentication:** 
- Supabase Auth with email/password only
- No OAuth, no magic links initially

**LLM Integration:**
- OpenAI only (gpt-3.5-turbo for cost)
- Project API key (no BYOK initially)
- Simple prompt template

**Caching:**
- Basic Redis with prompt hash as key
- 15-minute TTL
- No semantic similarity

**UI/UX:**
- Fixed overlay position
- 3 questions maximum
- No progressive disclosure
- No streaming

**Rate Limiting:**
- Simple counter in Redis per user
- 20 requests per hour for free users

## 2) What Problems This Solves

### 2.1 Removed Complexity Issues:
1. No multiple providers - eliminates adapter complexity, failover logic
2. No offline mode - removes local enhancement engine, sync issues  
3. No streaming - simpler API, easier error handling
4. No remote adapters - hardcode selectors, update via extension releases
5. No circuit breakers - just simple try/catch with user-friendly errors

### 2.2 Bootstrap-Friendly Benefits:
- Faster development - core feature in 2-3 weeks instead of 2-3 months
- Easier testing - fewer moving parts, simpler failure modes
- Lower costs - single LLM provider, minimal infrastructure
- Clearer user value - focus on core prompt enhancement, no feature bloat

## 3) Implementation Priority

### Phase 1 (MVP - 2 weeks):
1. Basic extension with prompt detection
2. Simple overlay UI with radio buttons
3. Single `/api/analyze` endpoint
4. OpenAI integration
5. Basic auth with Supabase

### Phase 2 (Polish - 1 week):
1. Improved site compatibility (5-6 major LLM sites)
2. Basic rate limiting
3. Simple dashboard to view prompt history
4. Error handling and user feedback

### Phase 3 (Scale prep):
- Only add complexity when you hit real limitations with real users
- Add features based on user feedback, not theoretical needs

## 4) What You Can Add Later (When Needed)

**When you have 50+ active users:**
- Multiple LLM providers
- BYOK support
- Better site detection

**When you have 200+ users:**
- Offline enhancement
- Streaming responses
- Advanced analytics

**When you have 500+ users:**
- Circuit breakers
- Multiple regions
- Complex caching

## 5) Tech Stack (Minimal)

**Extension:** Vanilla JS (no frameworks)
**Backend:** Next.js API routes
**Database:** Supabase (auth + postgres)
**Cache:** Upstash Redis
**LLM:** OpenAI only
**Deployment:** Vercel
**Monitoring:** Console.log initially, add Sentry later

## 6) Success Metrics (Simple)

- Daily active users
- Prompts enhanced per day  
- User retention (7-day, 30-day)
- Basic error rate tracking

That's it. Ship the minimal viable product, get users, then add complexity only when needed.