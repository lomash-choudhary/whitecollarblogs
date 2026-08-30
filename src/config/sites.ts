/**
 * Multi-site publishing registry.
 *
 * WhiteCollarBlogs (WCB) is the portal. Every post belongs to exactly one site.
 *
 *  - target: 'local'  -> the post is rendered by this very app (/blogs/[slug]).
 *  - target: 'github' -> the post is pushed to another website's GitHub repo,
 *                        which turns it into a markdown file and redeploys itself.
 *
 * Repo coordinates can be overridden with env vars so the same code works for
 * local testing and production without editing this file.
 */

import type { Where } from 'payload'

export type SiteTarget = 'local' | 'github'

export interface GithubTargetConfig {
  /** GitHub org/user that owns the website repo */
  owner: string
  /** Repository name */
  repo: string
  /** Branch the blog markdown gets committed to */
  branch: string
  /** repository_dispatch event_type the website's workflow listens for */
  eventType: string
  /** Name of the env var holding the fine-grained PAT for that repo */
  tokenEnv: string
}

export interface SiteConfig {
  /** Stable identifier stored on every post row */
  key: string
  /** Human label shown in the portal's website switcher */
  name: string
  /** Small helper line under the switcher */
  description: string
  target: SiteTarget
  /** Public origin of the website, used to build the live URL of a post */
  baseUrl: string
  /** Path segment the website serves its blogs from, e.g. /resources */
  blogPath: string
  /** Fallback hero image used when a post has no cover image */
  defaultHeroImage?: string
  /** Fallback category used when a post has no category */
  defaultCategory?: string
  github?: GithubTargetConfig
}

export const SITES: SiteConfig[] = [
  {
    key: 'wcb',
    name: 'White Collar Advice',
    description: 'New blogs publish to this CMS.',
    target: 'local',
    baseUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    blogPath: '/blogs',
  },
  {
    key: 'ovopainting',
    name: 'OVO Painting',
    description: 'New blogs publish to this website.',
    target: 'github',
    baseUrl: process.env.OVO_SITE_BASE_URL || 'https://www.ovopainting.com',
    blogPath: '/resources',
    defaultHeroImage: '/images/services/interior-painting.png',
    defaultCategory: 'Tips for Painting',
    github: {
      owner: process.env.OVO_GITHUB_OWNER || 'nshekhawat153-star',
      repo: process.env.OVO_GITHUB_REPO || 'ovopainting',
      branch: process.env.OVO_GITHUB_BRANCH || 'main',
      eventType: process.env.OVO_GITHUB_EVENT_TYPE || 'publish-blog',
      tokenEnv: 'OVO_GITHUB_TOKEN',
    },
  },
]

export const DEFAULT_SITE_KEY = 'wcb'

export function getSite(key?: string | null): SiteConfig {
  if (!key) return SITES[0]
  return SITES.find((s) => s.key === key) || SITES[0]
}

export function isKnownSite(key?: string | null): boolean {
  return Boolean(key && SITES.some((s) => s.key === key))
}

/** Lightweight shape safe to hand to client components. */
export interface PublicSite {
  key: string
  name: string
  description: string
  target: SiteTarget
  blogPath: string
  baseUrl: string
}

export function publicSites(): PublicSite[] {
  return SITES.map(({ key, name, description, target, blogPath, baseUrl }) => ({
    key,
    name,
    description,
    target,
    blogPath,
    baseUrl,
  }))
}

/**
 * Payload `where` clause that limits a query to one website.
 * Rows created before multi-site existed have a NULL site, so the default
 * website also matches those.
 */
export function siteWhere(siteKey: string): Where {
  if (siteKey === DEFAULT_SITE_KEY) {
    return {
      or: [{ site: { equals: DEFAULT_SITE_KEY } }, { site: { exists: false } }],
    }
  }
  return { site: { equals: siteKey } }
}
