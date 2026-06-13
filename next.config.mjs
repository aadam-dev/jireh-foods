import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['framer-motion'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    // Allows src/ directory imports via @/src/...
  },
};

export default withPWA({
  dest: 'public',
  // Only enable PWA in production — avoids service-worker noise during dev
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Aggressive caching for the POS shell and static assets
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,   // we handle reconnection ourselves in the POS page
  workboxOptions: {
    disableDevLogs: true,
    // Cache the POS page shell + static Next.js assets
    runtimeCaching: [
      {
        // Next.js immutable static chunks — cache-first forever
        urlPattern: /^\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        // Next.js image optimization — stale-while-revalidate
        urlPattern: /^\/_next\/image\?.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      {
        // POS menu — network-first with 5s timeout, fallback to cache
        // Critical: staff can browse menu even when internet is spotty
        urlPattern: /^https?:\/\/[^/]+\/api\/pos\/menu.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pos-menu',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // POS receipt settings — short network-first cache (cashier-safe endpoint)
        urlPattern: /^https?:\/\/[^/]+\/api\/pos\/settings.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pos-settings',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Google Fonts — cache-first (immutable CDN assets)
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})(nextConfig);
