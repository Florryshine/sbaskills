/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})
const nextConfig = withPWA({
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
    // public/ is deployed to Vercel's static asset network, not necessarily
    // bundled into the serverless functions that read it via fs at runtime
    // (lib/image-engine.js, lib/carousel-engine/render-canvas.js both read
    // public/fonts/Inter-Bold.ttf with fs.readFileSync). Without this, that
    // read can silently miss the file in production even though it works
    // locally, leaving text rendering with no font to fall back to.
    outputFileTracingIncludes: {
      '/api/**/*': ['./public/fonts/**'],
    },
  },
  webpack: (config, { isServer }) => {
    // Fix for external HTTPS imports (e.g., jszip from CDN)
    // Some dependencies may try to import from CDN URLs which webpack can't handle by default
    // Redirect CDN imports to local packages
    if (!isServer) {
      config.plugins.push(
        new (require('webpack').NormalModuleReplacementPlugin)(
          /^https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/+esm$/,
          require.resolve('jszip')
        )
      )
    }
    return config
  },
})
module.exports = nextConfig
