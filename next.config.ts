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
   * The blog root moved from `/blogs` to `/resources` on 2026-09-18, so that
   * all four websites serve a CMS article from one path and a writer never has
   * to remember which site puts articles where.
   *
   * Permanent (308), and kept rather than deleted later: every link already
   * shared, bookmarked or indexed at the old path is someone's route into the
   * article, and a moved page that 404s loses whatever ranking it had instead
   * of handing it to the new URL. `:slug*` catches the root and the query
   * string as well as an article.
   */
  async redirects() {
    return [
      { source: '/blogs', destination: '/resources', permanent: true },
      { source: '/blogs/:slug*', destination: '/resources/:slug*', permanent: true },
    ]
  },
}

export default withPayload(nextConfig)
