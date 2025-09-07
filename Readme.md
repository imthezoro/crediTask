# PromptOK - AI Prompt Enhancement Platform

A comprehensive SaaS platform for enhancing AI prompts with Chrome extension integration, user management, billing, and analytics.

## Features

- **Chrome Extension**: Enhance prompts directly in your browser
- **User Authentication**: Secure sign-up/sign-in with Supabase Auth
- **Subscription Management**: Free, Pro, and Enterprise plans with Stripe integration
- **Admin Dashboard**: Complete admin interface for user and system management
- **Analytics**: Usage tracking and performance metrics
- **Status Page**: Public system status and incident management
- **API Access**: RESTful API for Pro+ users
- **Monitoring**: Prometheus metrics and alerting

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth)
- **Payments**: Stripe, Razorpay
- **Monitoring**: Prometheus, Grafana
- **Deployment**: Vercel
- **Extension**: Chrome Extension (Manifest V3)

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Stripe account (for payments)

### Local Development

1. **Clone and install dependencies**:
```bash
git clone <your-repo>
cd promptok
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env.local
```

Add the following to `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

3. **Apply database migrations**:
```bash
# Using Supabase CLI
supabase db push

# Or manually run SQL files
psql -h your_host -U postgres -d your_db -f migration/001.sql
psql -h your_host -U postgres -d your_db -f migration/002.sql
psql -h your_host -U postgres -d your_db -f migration/003.sql
psql -h your_host -U postgres -d your_db -f migration/004_mvp_tables.sql
```

4. **Start development server**:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Database Schema

### Core Tables
- `user_profiles` - User information and subscription details
- `prompt_sessions` - Prompt enhancement requests and responses
- `payments` - Payment transactions and subscription history
- `daily_metrics` - Aggregated daily usage statistics
- `incidents` - System incidents and status updates

### Key Features
- Row Level Security (RLS) enabled
- Automatic timestamp updates
- Foreign key constraints
- Proper indexing for performance

## Deployment

### Vercel Deployment

1. **Deploy to Vercel**:
```bash
vercel --prod
```

2. **Set environment variables in Vercel**:
- Go to your Vercel project settings
- Add all environment variables from `.env.local`
- Ensure `NEXT_PUBLIC_BASE_URL` points to your production domain

3. **Configure webhooks**:
- Stripe webhook URL: `https://yourdomain.com/api/webhooks/payment`
- Add webhook events: `checkout.session.completed`, `invoice.payment_succeeded`

### Supabase Configuration

1. **Deploy Edge Functions**:
```bash
supabase functions deploy enhance-prompt
supabase functions deploy aggregate_daily_metrics
```

2. **Set up cron job for daily metrics**:
```bash
# Add to your cron scheduler (GitHub Actions, Vercel Cron, etc.)
curl -X POST "https://your-project.supabase.co/functions/v1/aggregate_daily_metrics" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

3. **Configure RLS policies**:
- Policies are automatically created by migration scripts
- Verify admin users have `is_admin = true` in `user_profiles`

## Monitoring & Observability

### Prometheus Setup

1. **Configure Prometheus** (`prometheus.yml`):
```yaml
scrape_configs:
  - job_name: 'promptok'
    static_configs:
      - targets: ['yourdomain.com']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 30s
```

2. **Grafana Dashboard**:
- Import dashboard from `monitoring/grafana-dashboard.json`
- Configure data source to point to your Prometheus instance

3. **Alert Rules**:
```yaml
groups:
  - name: promptok
    rules:
      - alert: HighPromptFailureRate
        expr: rate(prompt_failures_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High prompt failure rate detected"
      
      - alert: HighResponseTime
        expr: prompt_response_time_seconds > 2
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Response time exceeding 2 seconds"
```

## API Documentation

### Authentication
All API endpoints require authentication via Supabase JWT tokens.

### Endpoints

#### Public
- `GET /api/status` - System status and metrics
- `GET /status` - Public status page

#### User (Authenticated)
- `GET /dashboard` - User dashboard
- `GET /settings` - User settings
- `GET /billing` - Billing and payment history

#### Admin (Admin users only)
- `GET /admin` - Admin dashboard
- `GET /admin/users` - User management
- `GET /admin/payments` - Payment management
- `GET /admin/analytics` - Usage analytics
- `GET /admin/alerts` - System alerts
- `GET /api/admin/metrics` - Admin metrics API

#### Webhooks
- `POST /api/webhooks/payment` - Stripe payment webhooks
- `PUT /api/webhooks/payment` - Razorpay payment webhooks

#### Monitoring
- `GET /api/metrics/prometheus` - Prometheus metrics

## Chrome Extension Integration

### Installation
1. Load extension from `extension/` directory in Chrome
2. No manual API configuration needed — environment is auto-detected via `extension/env-config.js`
3. Users authenticate via popup linking to the web app

### How it works
1. Extension captures prompt text from supported AI platforms
2. Sends enhancement request to Supabase Edge Functions
3. Displays enhanced prompt to user
4. Logs session data for analytics

### Supported Platforms (Restricted Access)
The extension now only works on approved LLM sites and requires authentication with available credits:

- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Bard (bard.google.com)
- Poe (poe.com)
- Character.AI (character.ai)
- Perplexity (perplexity.ai)
- You.com (you.com)
- Microsoft Copilot (copilot.microsoft.com)
- HuggingFace (huggingface.co)
- Replicate (replicate.com)
- OpenRouter (openrouter.ai)

### Authentication & Usage Requirements
- Extension only activates on allowed sites (see manifest.json)
- Requires user authentication via JWT tokens
- Checks user credits/usage limits before showing enhancement UI
- Shows appropriate error messages for unauthenticated users or insufficient credits

### Environment Configuration
The Chrome extension automatically detects the environment via `extension/env-config.js` using the extension's unique ID (`chrome.runtime.id`).

- The mapping lives in `extension/env-config.js` under `extensionIdMapping`.
- If the current extension ID is found in the map, it selects that environment (`development` or `production`).
- If the ID is not found, it safely falls back to `development` (localhost), preventing accidental calls to production.

Example mapping:

```js
// extension/env-config.js
extensionIdMapping: {
  'agoffikldhbnplphjknagiacideikboj': 'development', // Dev extension ID
  // 'YOUR_PROD_EXTENSION_ID': 'production',        // Add when available
}
```

Safe defaults:
- Unknown/unmapped IDs → `development` → `http://localhost:3000`
- Production builds must be explicitly mapped to `production`

### Testing Scenarios

Use these approaches to test different environments:

1) Temporarily map your dev extension ID to production (recommended)

- Find your dev extension ID in `chrome://extensions` (enable Developer mode).
- Edit `extension/env-config.js` and map that ID to `'production'`:

```js
extensionIdMapping: {
  // 'agoffikldhbnplphjknagiacideikboj': 'development', // keep if still used for localhost
  'YOUR_DEV_EXTENSION_ID': 'production'                  // temporary for testing
}
```

- Reload the extension in `chrome://extensions`.
- Verify in DevTools console on any active page:

```js
await window.promptokEnvConfig.getApiBase() // should be https://prompt-ok.vercel.app
```

- Revert the mapping after testing so development goes back to localhost by default.

2) Temporarily change the development URL to production (quick but confusing)

- In `extension/env-config.js`, set `urls.development.apiBase = 'https://prompt-ok.vercel.app'`.
- Reload, test, then change it back to `http://localhost:3000`.

3) Change the fallback to production (not recommended)

- You can change the fallback in `initialize()` to use `production` when the ID is unmapped. This is risky because all unmapped builds will hit production; avoid unless absolutely necessary.

Important caveats:
- The offscreen auth bridge (`extension/offscreen.js`) builds `parentOrigin` using the current extension ID. If your production web app restricts the bridge to specific IDs, you may need to allowlist your test extension ID during testing.
- Do not commit temporary mappings of dev IDs to production.

Deprecated scripts:
- `extension/gemini-service.js` — functionality moved to `enhanced-content.js`.
- `extension/set-environment.js` — manual switching removed; environment is auto-detected.

## Manual Setup Steps

After deployment, complete these manual steps:

### 1. Database Setup
```bash
# Apply all migrations
supabase db push
# Or run SQL files manually in order
```

### 2. Admin User Setup
```sql
-- Set admin flag for your user
UPDATE user_profiles 
SET is_admin = true 
WHERE email = 'your-admin-email@example.com';
```

### 3. Stripe Configuration
- Configure webhook endpoints in Stripe dashboard
- Test payment flows in Stripe test mode
- Update webhook secrets in environment variables

### 4. Cron Jobs
Set up daily metrics aggregation:
```bash
# GitHub Actions example (.github/workflows/daily-metrics.yml)
name: Daily Metrics
on:
  schedule:
    - cron: '0 1 * * *'  # Run at 1 AM daily
jobs:
  aggregate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger aggregation
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/aggregate_daily_metrics" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

### 5. Monitoring Setup
- Deploy Prometheus and Grafana
- Configure alert rules
- Set up notification channels (Slack, email, etc.)

## Development Guidelines

### Code Structure
```
app/                    # Next.js App Router pages
├── (public)/          # Public pages (landing, pricing, etc.)
├── (auth)/            # Authentication pages
├── (dashboard)/       # User dashboard pages
├── admin/             # Admin pages
└── api/               # API routes

components/            # Reusable React components
lib/                   # Utility functions and configurations
migration/             # Database migration scripts
supabase/              # Supabase functions and config
extension/             # Chrome extension source
```

### Best Practices
- Use TypeScript for all new code
- Follow Next.js App Router patterns
- Implement proper error handling
- Add loading states for async operations
- Use Tailwind CSS for styling
- Write tests for critical functionality

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Verify Supabase URL and keys
   - Check RLS policies
   - Ensure migrations are applied

2. **Payment webhook failures**:
   - Verify webhook signatures
   - Check endpoint URLs
   - Review Stripe dashboard logs

3. **Extension not working**:
   - Check content script injection
   - Verify API endpoint configuration
   - Review browser console for errors

4. **Admin access denied**:
   - Ensure `is_admin = true` in database
   - Check RLS policies
   - Verify JWT token validity

### Support
- Check GitHub issues for known problems
- Review Supabase logs for database issues
- Monitor Vercel deployment logs
- Use browser dev tools for frontend debugging

## Usage Limits & Enforcement

### Single Source of Truth
Usage limits are enforced **only** in Supabase Edge Functions to maintain consistency and prevent bypasses:

#### Current Limits (Enforced in Edge Functions)
- **Paid Plans**: Unlimited usage
- **Free Users**: 10 prompts maximum (`usage_count < 10`)
- **Guest Users**: 5 prompts maximum (`usage_count < 5`)

#### Enforcement Points
1. **Primary**: `supabase/functions/enhance-prompt/index.ts` - Main enhancement endpoint
2. **Secondary**: `supabase/functions/guest-prompt/index.ts` - Guest-specific wrapper

#### What Was Removed
- **Next.js API Routes**: No longer check quotas (e.g., `/app/api/analyze/route.ts`)
- **lib/rateLimit.ts**: Still exists but usage checks removed from API routes
- **Extension Client**: Only provides UX feedback, not authoritative enforcement

#### Why This Architecture
- **Security**: Server-side enforcement prevents client bypasses
- **Consistency**: Single codebase manages all usage limits
- **Simplicity**: No need to sync limits across multiple files
- **Performance**: Edge Functions handle the core enhancement flow

#### Modifying Limits
To change usage limits, update only these constants:
```typescript
// supabase/functions/enhance-prompt/index.ts
const FREE_PLAN_LIMIT = 10 // Free users get 10 prompts

// supabase/functions/guest-prompt/index.ts  
const GUEST_QUOTA = 5 // Guest users get 5 prompts
```

#### Usage Tracking
- `usage_count` incremented after successful enhancements
- Stored in `user_profiles` table
- Checked before processing each request
- Reset behavior depends on your business logic (not implemented)

## License

MIT License - see LICENSE file for details.