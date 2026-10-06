/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [],
})
const nextConfig = withPWA({
  reactStrictMode: true,
  swcMinify: true,
  images: {
    // Images are already hosted on Cloudinary/Supabase. Disable Vercel's
    // Image Optimization to prevent Image Optimization Transformations usage.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
      'pdf-parse',
      'pdfjs-dist',
    ],
    outputFileTracingIncludes: {
      '/api/**/*': [
        './public/fonts/**',
        './node_modules/pdfjs-dist/legacy/build/**',
      ],
    },
  },
  webpack: (config, { isServer }) => {
    // Fix for external HTTPS imports (e.g., jszip from CDN)
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
