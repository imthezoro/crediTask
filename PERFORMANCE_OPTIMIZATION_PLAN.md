# PromptOK Performance and UX Optimization Plan

This plan is tailored to the current codebase (Next.js 14 App Router, Supabase, Vercel). It addresses slow initial loads and end‑user latency with actionable changes mapped to your requested items.

Repo context references (validated against current repo):
- Next.js config: `next.config.js` (only `experimental.serverActions.allowedOrigins` present)
- App Router used: `app/` directory present, no `pages/`
- Supabase setup files present under `lib/` (client/server helpers)
- Heavy UI modules present: `components/Chart.tsx` and `app/admin/analytics/page.tsx` (charts)
- No global use of `next/image`, no `next/font` detected
- No `getServerSideProps`/`getStaticProps` present (App Router)
- Revalidation currently used on `app/admin/analytics/page.tsx`: `export const revalidate = 60`

---

## 1) Prefer ISR over SSR

App Router doesn’t use `getStaticProps`; instead use segment config. Default most marketing/non‑auth pages to static with revalidation.

Recommended baseline for static pages:
- Files: `app/page.tsx`, `app/pricing/page.tsx`, `app/faq/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/refund-policy/page.tsx`, `app/extension-instructions/page.tsx`, `app/contact/page.tsx`
- Add at top of each file:

```ts
// Route Segment Options
export const revalidate = 3600; // 1h, adjust per page needs
export const dynamic = 'force-static';
```

For authenticated dashboards with semi-static sections (e.g., `app/admin/analytics/page.tsx`), prefer partial static + client hydration:

```ts
export const revalidate = 300; // cache base analytics for 5m (note: analytics page currently uses 60s)
```

Use on route handlers that can be cached:

```ts
// app/api/status/route.ts
export const revalidate = 30;
```

Note: Protect truly dynamic/user-specific data by keeping them `dynamic = 'force-dynamic'` or using no revalidate.

---

## 2) Cache API responses with Vercel Edge cache

For API routes that are safe to cache (public, non-auth, non-PII), set `Cache-Control` with `s-maxage` and `stale-while-revalidate` and tag revalidation when needed.

Example pattern for route handlers:

```ts
import { NextResponse } from 'next/server';

export async function GET() {
  // ...fetch data
  return new NextResponse(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      // Edge cache (CDN) for 5 minutes, allow 1 day stale while revalidating
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
```

For server‑side `fetch` calls to external APIs, enable Next.js request caching to leverage Edge cache:

```ts
await fetch(url, { next: { revalidate: 300 } });
```

Additionally, leverage on-demand revalidation with `revalidatePath()`/`revalidateTag()` in server actions when you mutate data.

Validation notes for this repo:
- Many `app/api/*` handlers appear uncached by default. Introduce headers selectively for public, non-auth routes (e.g., `/api/status`, marketing data) but avoid caching user/PII endpoints.

---

## 3) Fetch only necessary fields from Supabase

Audit Supabase queries and limit the selected columns to reduce network and serialization costs.

- In server utilities, continue the pattern of explicit column selection (e.g., `id, email`).
- Review all `.select('*')` occurrences (keep none in the critical paths) and replace with explicit columns, e.g.:

```ts
const { data } = await supabase
  .from('user_profiles')
  .select('id, email, plan')
  .eq('id', userId)
  .single();
```

- Use `range()` for pagination and `count: 'exact'` only when strictly needed.
- Prefer RPCs or materialized views for complex joins where appropriate.

Database index guidance specific to current usage:
- Ensure B‑tree indexes exist on `prompt_sessions(created_at)`, `prompt_sessions(user_id)`, and partial indexes for common filters (e.g., `WHERE status = 'completed'`).
- For analytics aggregates, consider a daily rollup table or a materialized view refreshed via a cron/Edge function if query volume grows.

---

## 4) Dynamic imports for heavy components (charts, editors, maps)

`components/Chart.tsx` and `app/admin/analytics/page.tsx` currently import charts directly. Load them dynamically on the client and disable SSR to avoid blocking TTFB and reducing JS on the server path.

Example:

```ts
// app/admin/analytics/page.tsx
import dynamic from 'next/dynamic';

const AnalyticsChart = dynamic(() => import('@/components/Chart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-muted" />,
});
```

Apply the same pattern to any map/editor modules (e.g., `mapbox`, `leaflet`, `monaco`, `codemirror`, `quill`) if/when added.

Optional enhancements:
- Wrap heavy charts in `<Suspense>` with skeletons to improve perceived performance.
- Gate render behind an `IntersectionObserver` (render on first viewport entry) for below‑the‑fold charts.

---

## 5) Optimize images with `next/image` and modern formats

- Replace `<img>` usage with `next/image`.
- Configure remote domains in `next.config.js` if you load external images:

```js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'your-cdn.com' },
    ],
  },
};
```

- Prefer `fill` or explicit `width`/`height` and `sizes` to prevent CLS.
- Use `placeholder="blur"` for LCP images and consider `priority` for above-the-fold hero images.
 
Validation notes for this repo:
- Large hero/illustrations on `app/page.tsx` (if any) should be migrated first. Configure remote domains in `next.config.js` only when actually needed to avoid overbroad allowances.

---

## 6) Enable connection pooling in Supabase (guide)

Vercel serverless can open many connections; use Supabase’s PgBouncer connection pooling.

Steps:
1. In the Supabase dashboard, open your project → Database → Connection Pooling.
2. Enable PgBouncer (transaction mode). Copy the Pooler connection string (usually port 6543).
3. Update server-side clients to use the pooler URL (keep anon key/service role the same). For `@supabase/supabase-js` http client, pooling impacts Postgres connections used by PostgREST automatically on Supabase. If using direct Postgres connections elsewhere, ensure those use the pooler DSN.
4. For edge functions or high QPS APIs, prefer serverless patterns (short queries, limited concurrency) and ensure keep‑alive is enabled by platform (Vercel default).

Note: Because your app uses Supabase’s HTTP APIs (PostgREST) via `@supabase/supabase-js`, you benefit indirectly. If you run any direct Postgres drivers (not detected), switch them to the pooler DSN.

---

## 7) Use Server Components to reduce client JS

- Keep pages/components server by default. Move `use client` to the smallest leaf components that need interactivity.
- Server fetches run on the server boundary and don’t bundle data fetching libraries/client code.
- Example refactor: server render stats and hydrate dynamic chart only when visible (dynamic import), passing compact data via props.

Checklist:
- Audit each file under `app/**/page.tsx`. Remove `use client` from any page that doesn’t need it.
- Keep form actions as server actions when possible.
 - In `app/admin/analytics/page.tsx`, keep the data fetch server‑side (already done) and pass compact datasets into a dynamically imported client chart.

---

## 8) Reduce bundle size and improve tree‑shaking

- Use `optimizePackageImports` (Next 14+ experimental) to tree‑shake large UI libs:

```js
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'recharts',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
    ],
  },
};
module.exports = nextConfig;
```

- Avoid importing server‑only utilities in client modules. Keep `@supabase/supabase-js` usage minimal on the client; prefer server reads, pass data as props.
- Add bundle analyzer to find large chunks:

```bash
npm i -D @next/bundle-analyzer
```

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' });
module.exports = withBundleAnalyzer(nextConfig);
```

Run: `ANALYZE=true npm run build` and inspect `/analyze` output.

What to look for in this repo:
- Verify that `recharts` is only bundled on pages where charts are used (after dynamic import).
- Ensure `@supabase/supabase-js` isn’t leaking into large client bundles unnecessarily (keep client usage minimal).
- Check for duplicate React or Radix chunks and consolidate imports.

---

## 9) Prefetch and cache client data (SWR/React Query)

For client-only data that changes frequently (e.g., user-scoped widgets), standardize on SWR or React Query.

SWR sample:

```ts
import useSWR from 'swr';

function Widget() {
  const { data, error, isLoading } = useSWR('/api/status', (u) => fetch(u).then(r => r.json()), { revalidateOnFocus: false, dedupingInterval: 30000 });
  // ...render
}
```

This reduces refetching, dedupes requests, and improves perceived latency via caching.

Repo suitability:
- Use SWR/React Query only for client‑only islands. Server components should fetch server‑side to avoid client JS.

---

## 10) Fonts: self‑hosted with `next/font` and preload

- Replace Google Fonts link tags with `next/font/google` to inline critical CSS and preload.

Example in `app/layout.tsx`:

```ts
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: true });

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

If you prefer full self-hosting, download the font files and use `next/font/local`.

Validation notes for this repo:
- No `next/font` usage detected. Adopt `next/font/google` for primary text (e.g., Inter) with `display: 'swap'`. This reduces render‑blocking and improves LCP.

---

## 11) Additional Next.js config hardening

- Enable compression (on by default in production) and ensure SWC minification:

```js
module.exports = {
  compress: true,
  swcMinify: true,
};
```

- Configure images for AVIF/WebP (see section 5).
- Validate `headers()` in `next.config.js` if you need global caching for static assets.

Optional headers for public assets (example):
```js
// next.config.js
async headers() {
  return [
    {
      source: '/:all*(css|js|woff2|ttf)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ]
}
```

Additional build/runtime tips:
- Disable production browser source maps unless actively needed to reduce build output size and leak surface:

```js
module.exports = {
  productionBrowserSourceMaps: false,
}
```

- Disable the `x-powered-by` header (minor security + tiny header bytes):

```js
module.exports = {
  poweredByHeader: false,
}
```

- Ensure your production domain is added to `experimental.serverActions.allowedOrigins` in `next.config.js` (currently only `localhost:3000`) so server actions don’t fall back or error in prod.

---

## 12) Prefer Edge runtime for public, cacheable APIs and slim middleware

- For truly public endpoints that serve the same response to all users (e.g., status, marketing metrics), run them on the Edge runtime and use short revalidate windows or explicit `Cache-Control` headers. This improves global TTFB.

Example route handler:

```ts
// app/api/status/route.ts
export const runtime = 'edge';
export const revalidate = 30;
```

- Keep middleware light. Your `middleware.ts` currently creates a Supabase client and can hit the database to check profile status for `/dashboard` and `/auth/**`. That’s expected, but ensure:
  - The `config.matcher` excludes as much as possible (static files are already excluded; images are excluded too, which is good).
  - Short‑lived in‑memory caching is used for profile checks (already present via `profileCache`). Consider a small TTL (e.g., 30–60s) and invalidate on auth state changes.
  - Avoid expanding middleware coverage; prefer route‑level guards where feasible.

- Prefer extracting any heavy, user‑specific checks out of middleware into server actions/route handlers where you can leverage caching/tags.

---

## 13) Control client prefetching to avoid network pressure

- Next.js App Router will prefetch links in/near viewport by default. On pages with many links (tables, lists), disable prefetching to reduce bandwidth and CPU:

```tsx
import Link from 'next/link'

<Link href="/some-heavy-route" prefetch={false}>Open</Link>
```

- For client islands that fetch frequently, coordinate with SWR/React Query deduping settings (see section 9) to prevent cascaded background fetches after navigation.

---

## 14) Revalidation tags and mutation hooks (patterns)

- When mutating data via server actions or route handlers, invalidate only the relevant caches using tags:

```ts
import { revalidateTag } from 'next/cache'

export async function updateSettings(input: FormData) {
  // ...perform mutation
  revalidateTag('settings')
}
```

- On the read path, tag the fetch:

```ts
await fetch('/api/settings', { next: { tags: ['settings'], revalidate: 300 } })
```

This avoids broad page revalidation and keeps ISR efficient.

---

## 15) Monitoring and performance budgets

- Initialize `@vercel/analytics` and `@vercel/speed-insights` in `app/layout.tsx` to continuously track Core Web Vitals.
- Add Lighthouse CI or Speed Insights to CI with budgets (e.g., JS < 200KB gz, LCP < 2.5s on 4G, TTFB < 600ms).
- Track bundle sizes per route using the bundle analyzer artifact on each release.

## Admin area performance isolation (repo‑specific)

Goal: You are the only admin user. Keep admin functionality fast for you while ensuring it never slows down the public app.

1) Disable prefetching for admin links
- Reason: Next.js prefetches links in/near the viewport. This can pull heavy admin bundles (e.g., charts) into public sessions.
- Code changes:
  - Update any navigation link to admin (e.g., `components/Header.tsx`) to: `<Link href="/admin" prefetch={false}>Admin</Link>` and for subroutes: `<Link href="/admin/analytics" prefetch={false}>Analytics</Link>`.
  - If you render an Admin link only for admins, also keep `prefetch={false}` to avoid background warming.

2) Dynamically import charts in admin analytics
- Reason: `recharts` and similar libraries are heavy. Dynamic import with `ssr: false` keeps chart code off the server path and out of other bundles.
- Code changes:
  - In `app/admin/analytics/page.tsx`, replace `import Chart from '@/components/Chart'` with:
    ```ts
    import dynamic from 'next/dynamic'
    const Chart = dynamic(() => import('@/components/Chart'), {
      ssr: false,
      loading: () => <div className="h-64 animate-pulse rounded bg-muted" />,
    })
    ```

3) Keep admin pages dynamic unless you explicitly want caching
- Reason: As sole admin, you benefit from fresher data over caching complexity. Dynamic routes avoid ISR invalidation work and build-time coupling.
- Code changes:
  - Consider removing `export const revalidate = 60` from `app/admin/analytics/page.tsx` (or set `export const dynamic = 'force-dynamic'`).
  - For server-side fetches on admin pages, prefer `cache: 'no-store'` where appropriate.

4) Keep middleware scoped and lean (already good)
- Reason: Avoid global overhead. Your `middleware.ts` already excludes static assets and images, and uses a `profileCache` to minimize DB hits.
- Code changes:
  - Keep `config.matcher` as-is or narrower. If `profileCache` supports TTL, set a small TTL (30–60s) and invalidate it on auth state changes.

5) Confirm admin exclusion from SEO/crawling (already configured)
- Reason: Prevent crawlers from hitting admin, which can distort analytics and consume resources.
- Code changes:
  - `next-sitemap.config.js` already has `exclude: ['/admin/*']` and robots disallow for `/admin/`. No change needed—just keep this policy.

6) Optional: Skip third‑party analytics/scripts on admin
- Reason: Reduces noise and network usage on admin pages.
- Code changes:
  - In `app/layout.tsx`, conditionally render any third-party analytics only when `!pathname.startsWith('/admin')`.

7) Runtime selection for admin APIs
- Reason: If admin routes use Node‑specific APIs, prefer Node runtime; for simple public endpoints used by admin, Edge can improve TTFB.
- Code changes:
  - For admin route handlers needing Node APIs: `export const runtime = 'nodejs'`.
  - For public, cacheable endpoints (e.g., `/api/status`): `export const runtime = 'edge'` plus short `revalidate` or `Cache-Control`.

8) Reduce DB payload on admin queries
- Reason: Faster responses and lower bandwidth, especially for dashboards with multiple queries.
- Code changes:
  - Replace any broad selects with explicit columns. Keep counts using `{ head: true, count: 'exact' }` (already used in many places).

9) Prefer admin-only layout/route group if the area grows
- Reason: Keeps admin providers/UI code isolated from public layout and bundles.
- Code changes:
  - Optionally move admin under `app/(admin)/admin/` with a minimal server `layout.tsx`. Do not add `use client` at layout level.

10) Bundle oversight
- Reason: Ensure heavy libs (e.g., `recharts`) only load in admin routes.
- Code changes:
  - Use bundle analyzer (`ANALYZE=true npm run build`) and confirm `recharts` only appears in admin analytics chunks after dynamic import.

---
## Page-by-page quick wins (repo‑specific)

- `app/page.tsx`: Static (ISR 1–6h), optimize hero image with `<Image>` + `priority`.
- `app/pricing/page.tsx`, `app/faq/page.tsx`: Static, long revalidate (24h).
- `app/admin/analytics/page.tsx`: Already a server component with `revalidate = 60`. Keep server fetching, and dynamic import charts with `ssr: false`; pass compact data arrays.
- `app/settings/page.tsx`: Server component; fetch Supabase profile server-side then hydrate minimal client islands for interactive widgets only.

Additional repo‑specific notes:
- `app/layout.tsx` footer is static; keep it server‑rendered. Consider moving non‑critical scripts to `defer`/`async` (already using `defer` for `extension-sync.js`).
- Avoid adding `use client` at the layout level; confine interactivity to leaf components.

## Migration Checklist (copy/paste)
- [ ] Add `export const revalidate = <seconds>` to static pages and cacheable route handlers (note: analytics already has `60s`)
- [ ] Add `Cache-Control: s-maxage=…` headers to public API routes
- [ ] Replace `<img>` with `next/image` and configure `next.config.js` `images.formats`
- [ ] Introduce dynamic imports for `components/Chart.tsx` and other heavy widgets (`ssr: false`)
- [ ] Review Supabase selects to only fetch needed columns; paginate
- [ ] Ensure indexes on `prompt_sessions(created_at)`, `prompt_sessions(user_id)`; add partial indexes for common filters
- [ ] Audit `use client`; minimize client components
- [ ] Add bundle analyzer and enable `optimizePackageImports`
- [ ] Adopt SWR/React Query for client‑side widgets only where needed
- [ ] Switch to `next/font` for typography with `display: 'swap'`
- [ ] Enable/verify Supabase PgBouncer pool usage
- [ ] Optional: Add immutable caching headers for static assets in `next.config.js`

---

## Notes tied to your repo (corrected)

- No `next/font` usage and no Google Fonts were detected; adopt `next/font` to improve LCP.
- No `next/image` usage found; migrate hero and large images first for highest ROI.

---

## Rollout Plan

1) Week 1: Static/ISR baseline (extend beyond analytics), Edge cache headers, `next/image`, dynamic charts.
2) Week 2: Server component audit, bundle analyzer, optimize imports, adopt `next/font`.
3) Week 3: SWR patterns for client widgets, revalidation hooks on mutations, Supabase query audits.
4) Measure: Vercel Analytics + Speed Insights and Lighthouse CI; target TTFB↓, LCP↓, JS payload↓.
## Step-by-step implementation guide (execute and verify one step at a time)

Follow these sequential steps. After each step, run verification before proceeding.

1) Establish performance baseline
- What to do: Run a production build and collect initial metrics.
  - Commands: `npm run build` then `npm start` (locally), also run `ANALYZE=true npm run build` if bundle analyzer is already configured.
- Verify: Note TTFB/LCP via Lighthouse in Chrome (Desktop/Simulated mobile). Record JS payload per route from analyzer if available.

2) Default ISR for marketing pages
- What to do: On static pages (e.g., `app/page.tsx`, `app/pricing/page.tsx`, `app/faq/page.tsx`, etc.), add at top: `export const revalidate = 3600;` and `export const dynamic = 'force-static'`.
- Verify: `next build` shows those routes as static; first request TTFB improves; subsequent requests are served from cache.

3) Dynamic import charts in admin analytics
- What to do: In `app/admin/analytics/page.tsx`, replace direct chart import with `next/dynamic` and `ssr: false`. Show a skeleton loader while loading.
- Verify: Production build should show `recharts` only in admin chunks. Visiting non-admin routes should not load chart JS.

4) Disable prefetching for admin links
- What to do: In navigation (e.g., `components/Header.tsx`), set `prefetch={false}` on links to `/admin` and `/admin/analytics`.
- Verify: On public pages, DevTools Network should not prefetch admin route assets when links enter the viewport.

5) Add Cache-Control headers for public, non-auth APIs
- What to do: For endpoints like `app/api/status/route.ts`, set `revalidate = 30` or return `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.
- Verify: DevTools Network → Response Headers include `cache-control`. Repeat requests should be faster and show `cf-cache-status`/`age` when deployed on Vercel.

6) Switch hero/large images to `next/image`
- What to do: Replace `<img>` on landing/marketing pages with `<Image>`; add sizes/width/height and `priority` for the hero.
- Verify: Lighthouse shows improved LCP and reduced CLS. DevTools shows AVIF/WebP when supported.

7) Configure image formats and (optionally) remote patterns
- What to do: In `next.config.js`, add `images.formats = ['image/avif', 'image/webp']`. Add `remotePatterns` only if you actually serve external images.
- Verify: Rebuild; inspect Network → image content-type shows AVIF/WebP where applicable.

8) Adopt `next/font` for primary typography
- What to do: In `app/layout.tsx`, import a Google font via `next/font/google` (e.g., Inter with `display: 'swap'`) and apply the class to `<html>`.
- Verify: Lighthouse shows reduced render-blocking resources; text remains visible during webfont load.

9) Add bundle analyzer and review large chunks
- What to do: Add `@next/bundle-analyzer` and wrap `next.config.js` with it (enabled when `ANALYZE=true`).
- Verify: Run `ANALYZE=true npm run build`. Inspect `/analyze` output; confirm `recharts` only appears on admin analytics and check if `@supabase/supabase-js` is limited to server/client islands where needed.

10) Optional: enable `optimizePackageImports` (experimental)
- What to do: In `next.config.js` `experimental.optimizePackageImports` for `recharts`, `@radix-ui/*`.
- Verify: Rebuild and compare analyzer output for reduced chunk sizes. If issues appear, revert this step.

11) Audit `use client` and shift to Server Components where possible
- What to do: Review `app/**/page.tsx` and components. Remove `use client` from pages that don’t need it; keep it only for small interactive leaf components.
- Verify: Rebuild and confirm reduced client JS on affected routes; Lighthouse/Analyzer show smaller client bundles.

12) Supabase query slimming
- What to do: Replace broad selects with explicit columns; paginate with `range()`. Use `count: 'exact'` only when necessary.
- Verify: DevTools Network shows smaller JSON payloads; server logs/metrics show reduced response times.

13) Database index check
- What to do: Ensure indexes on `prompt_sessions(created_at)` and `prompt_sessions(user_id)` exist; add partial indexes for common filters (e.g., status). Consider materialized views/daily rollups for heavy analytics.
- Verify: Query plans (via Supabase SQL editor) show index usage; latency decreases on dashboards.

14) Edge runtime for public endpoints and preferred regions
- What to do: For truly public endpoints (e.g., `/api/status`), set `export const runtime = 'edge'` and optionally `export const preferredRegion = 'home'` or nearest to your DB.
- Verify: Global TTFB improves; headers show edge execution. Measure from different geos if possible.

15) Keep middleware lean and cache-aware
- What to do: Ensure `middleware.ts` matcher excludes static assets (already done). Keep `profileCache` TTL short (30–60s) and invalidate on auth changes.
- Verify: Observe fewer DB checks during navigation; no noticeable added latency on non-protected routes.

16) Static asset headers and Next.js config hardening
- What to do: In `next.config.js`, add immutable caching headers for assets, disable `x-powered-by`, and disable production browser source maps unless needed.
- Verify: Response headers show `Cache-Control: immutable` for assets; slightly smaller production build output.

17) Monitoring and budgets
- What to do: Ensure `@vercel/analytics` and `@vercel/speed-insights` are initialized in `app/layout.tsx`. Add Lighthouse CI (optional) with budgets.
- Verify: Metrics appear in Vercel dashboard. CI passes budgets or flags regressions.

18) Final pass and documentation
- What to do: Re-run `ANALYZE=true npm run build`, Lighthouse (mobile & desktop), and verify Core Web Vitals after deploy.
- Verify: TTFB↓, LCP↓, total JS payload↓. Update this doc with before/after metrics and note any tradeoffs.
