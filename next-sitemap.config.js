/** @type {import('next-sitemap').IConfig} */
module.exports = {
  // Prefer setting NEXT_PUBLIC_SITE_URL in your envs (e.g. https://promptok.app)
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  generateRobotsTxt: true,
  sitemapSize: 5000,
  outDir: 'public',
  // Exclude non-public routes
  exclude: [
    '/auth/*',
    '/admin/*',
    '/api/*',
    '/dashboard',
    '/settings',
    '/billing',
    '/oauth-debug-test',
    '/oauth-debug-test.html',
    '/supabase-config-test',
    '/supabase-config-test.html',
  ],
  // Optional: add additional robots.txt policies
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/admin/', '/api/', '/auth/', '/dashboard', '/settings'] },
    ],
  },
  // Adjust priority and changefreq for key routes
  transform: async (config, path) => {
    const map = {
      '/': { priority: 1.0, changefreq: 'daily' },
      '/pricing': { priority: 0.8, changefreq: 'weekly' },
      '/privacy': { priority: 0.3, changefreq: 'yearly' },
      '/terms': { priority: 0.3, changefreq: 'yearly' },
    };
    const meta = map[path] || { priority: 0.5, changefreq: 'weekly' };
    return {
      loc: path,
      changefreq: meta.changefreq,
      priority: meta.priority,
      lastmod: new Date().toISOString(),
      alternateRefs: config.alternateRefs ?? [],
    };
  },
};
