import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow all external http/https image URLs (Unsplash, Supabase storage, CDNs, etc.)
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  /**
   * The public blog this app used to serve is gone (2026-09-20), so the two
   * old article paths both have to land somewhere that exists. `/blogs` was
   * redirected to `/resources` when the route moved on 2026-09-18; with
   * `/resources` itself removed, that redirect would only point at a 404, so
   * both paths now go to the dashboard — the one page this app still has.
   *
   * Permanent (308) because the pages are not coming back. `:slug*` catches
   * an article as well as the root.
   */
  async redirects() {
    return [
      { source: '/blogs', destination: '/dashboard', permanent: true },
      { source: '/blogs/:slug*', destination: '/dashboard', permanent: true },
      { source: '/resources', destination: '/dashboard', permanent: true },
      { source: '/resources/:slug*', destination: '/dashboard', permanent: true },
    ]
  },
}

export default withPayload(nextConfig)
