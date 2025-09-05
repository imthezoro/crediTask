/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header for security
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@supabase/supabase-js',
      'date-fns',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Add remote patterns when external images are needed
    // remotePatterns: [
    //   { protocol: 'https', hostname: 'your-cdn.com' },
    // ],
  },
  // Add security and performance headers
  async headers() {
    return [
      {
        // Apply to all static assets
        source: '/:path*\\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)$',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year cache for static assets
          },
        ],
      },
      {
        // Apply to all routes for security
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);


