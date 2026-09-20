/**
 * Multi-site publishing registry.
 *
 * The Homeowner Marketers blog CMS is the portal. Every post belongs to
 * exactly one site.
 *
 *  - target: 'local'  -> the post stays in this CMS and is served nowhere. The
 *                        app's own public blog was removed on 2026-09-20, so
 *                        this is a holding bucket, not a website.
 *  - target: 'github' -> the post is pushed to another website's GitHub repo,
 *                        which turns it into a markdown file and redeploys itself.
 *
 * This file defines *what* a website is — its name, where it serves blogs from,
 * its fallback category. It never contains *where to deploy to*: the repo and
 * public URL of every GitHub target come from that site's env vars, so the
 * same build can point at a fork locally and the real repo in production, and
 * so a value like an owner name exists in exactly one place.
 *
 * Each site declares an `envPrefix`; the selected website in the sidebar is
 * what decides which prefix a publish reads.
 */

import type { Where } from 'payload'

export type SiteTarget = 'local' | 'github'

/**
 * The `repository_dispatch` event_type every receiving workflow listens for
 * (`on: repository_dispatch: types: [publish-blog]`). It is a contract between
 * this code and a workflow file that is copied verbatim into each site repo,
 * so it is the same for all of them — one constant, not a per-site setting and
 * certainly not an env var.
 */
export const DISPATCH_EVENT_TYPE = 'publish-blog'

export interface GithubTargetConfig {
  /** Env var prefix for this site, e.g. 'OVO' -> OVO_GITHUB_REPO */
  envPrefix: string
  /** Account that owns the repo — the left half of <PREFIX>_GITHUB_REPO */
  owner: string
  /** Repository name — the right half of <PREFIX>_GITHUB_REPO */
  repo: string
  /** Name of the env var holding the fine-grained PAT for that repo */
  tokenEnv: string
}

/**
 * `owner/repo`, the way GitHub itself writes a repository's full name.
 *
 * Owner: 1-39 of alphanumeric or hyphen. Repo: alphanumeric, dot, underscore,
 * hyphen. Both halves end up interpolated into an api.github.com path, so
 * anything outside that — a stray slash, a `..` — is rejected here rather
 * than becoming a request to some other endpoint.
 */
const REPO_SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/

/**
 * Builds a target from the environment. Deliberately no fallbacks: a wrong
 * default here would dispatch a finished article into somebody else's
 * repository, so an unset var must surface as a publish error naming the var
 * (see publishToSite) rather than quietly resolve to something plausible.
 *
 * The owner is *not* a separate env var. GitHub identifies a repository by the
 * pair, `api.github.com/repos/<owner>/<repo>/dispatches` needs both halves,
 * and a bare repo name is ambiguous — a fork of `ovopainting` carries the same
 * repo name as the original and differs only in owner. Keeping them in one var
 * means the two halves cannot be half-updated: switching to a fork is one
 * edit, not two that must agree.
 *
 * No branch is carried. `repository_dispatch` only ever runs the workflow on
 * the repo's default branch, and the workflow commits back to that same ref
 * (`GITHUB_REF_NAME`) — a branch sent from here would be ignored, so sending
 * one would only imply control the CMS does not have.
 */
function githubTarget(envPrefix: string): GithubTargetConfig {
  const slug = (process.env[`${envPrefix}_GITHUB_REPO`] || '').trim()
  const [owner, repo] = REPO_SLUG.test(slug) ? slug.split('/') : ['', '']
  return {
    envPrefix,
    owner,
    repo,
    tokenEnv: `${envPrefix}_GITHUB_TOKEN`,
  }
}

/**
 * Public origin of a site, from <PREFIX>_SITE_BASE_URL. Only used to show a
 * writer where the article will appear, so an unset var costs a link, not a
 * publish.
 */
function siteBaseUrl(envPrefix: string): string {
  return process.env[`${envPrefix}_SITE_BASE_URL`] || ''
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
  /**
   * Whether a writer may pick this website in the sidebar switcher.
   * Defaults to true; only `wcb` sets it false. See the note on that entry —
   * it has to stay in `SITES` while being absent from the dropdown, and those
   * are two different questions.
   */
  selectable?: boolean
  github?: GithubTargetConfig
}

export const SITES: SiteConfig[] = [
  {
    key: 'wcb',
    name: 'Homeowner Marketers',
    description: 'Stays in this CMS — not pushed to a website.',
    target: 'local',
    // Not a deploy target — and since 2026-09-20 not a website either: this
    // app serves no public article page at all. The key stays because it is
    // `DEFAULT_SITE_KEY`, which is what every row written before multi-site
    // existed (site NULL) is matched by — renaming or removing it would
    // reassign those posts to whichever site happened to be first.
    //
    // Off the dropdown since 2026-09-20. It published nowhere, so choosing it
    // meant writing an article that went nowhere — and it was the one entry
    // carrying the company's own name, which read as a fourth website sitting
    // beside the three real ones. **Hiding it is not the same as deleting
    // it**: `siteWhere(DEFAULT_SITE_KEY)` is still the only clause that
    // matches a NULL `site`, `getSite()` still falls back here, and
    // `Posts.ts` still parks a row with an unrecognised site on this key
    // rather than on whichever website happens to be first in the list. Take
    // the entry out of `SITES` and all three of those quietly become OVO
    // Painting's.
    selectable: false,
    baseUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    // Empty on purpose. `blogPath` names the route a website serves an article
    // from, and this app no longer has one; `/resources` here would only build
    // canonicals and "view it live" links pointing at a 404.
    blogPath: '',
    defaultCategory: 'General',
  },
  {
    key: 'ovopainting',
    name: 'OVO Painting',
    description: 'New blogs publish to this website.',
    target: 'github',
    baseUrl: siteBaseUrl('OVO'),
    blogPath: '/resources',
    // Checked against the file on disk in that repo. The old value,
    // `/images/services/interior-painting.png`, was never there — only
    // `-hero.webp` and `-service.webp` are — so every article that fell
    // through to it opened with a broken-image icon. A default that 404s is
    // worse than no default: `next/image` renders the alt text and the
    // article's first impression is a broken picture.
    defaultHeroImage: '/images/services/interior-painting-hero.webp',
    defaultCategory: 'Tips for Painting',
    github: githubTarget('OVO'),
  },
  {
    key: 'durahome',
    name: 'Durahome Painting',
    description: 'New blogs publish to this website.',
    target: 'github',
    baseUrl: siteBaseUrl('DURAHOME'),
    blogPath: '/resources',
    defaultCategory: 'PAINTING TIPS',
    github: githubTarget('DURAHOME'),
  },
  {
    key: 'rangerpainting',
    name: 'Ranger Painting',
    description: 'New blogs publish to this website.',
    target: 'github',
    baseUrl: siteBaseUrl('RANGER'),
    // /resources, not /blog. Ranger keeps its older hand-written articles at
    // /blog/<slug>, but a CMS publish lands at /resources/<slug> on all four
    // sites so one portal publish gives one URL shape everywhere.
    blogPath: '/resources',
    defaultCategory: 'Interior Painting',
    github: githubTarget('RANGER'),
  },
]

/**
 * Env vars a GitHub target cannot publish without, and which of them are unset
 * or malformed. Returned as var names, with the expected shape where that is
 * not obvious, so the writer is told exactly what to add.
 */
export function missingSiteEnv(site: SiteConfig): string[] {
  if (site.target !== 'github' || !site.github) return []
  const { envPrefix, owner, repo, tokenEnv } = site.github
  return [
    owner && repo ? '' : `${envPrefix}_GITHUB_REPO (as owner/repo)`,
    process.env[tokenEnv] ? '' : tokenEnv,
  ].filter(Boolean)
}

export const DEFAULT_SITE_KEY = 'wcb'

export function getSite(key?: string | null): SiteConfig {
  return SITES.find((site) => site.key === key) || SITES[0]
}

export function isKnownSite(key?: string | null): boolean {
  return Boolean(key && SITES.some((s) => s.key === key))
}

/**
 * Narrower than `isKnownSite`: a key may be real and still not something a
 * writer is allowed to be looking at. `wcb` is exactly that, so a stale
 * cookie naming it has to be treated as no choice at all rather than pinning
 * the dashboard to a website the switcher cannot show.
 */
export function isSelectableSite(key?: string | null): boolean {
  return Boolean(key && SELECTABLE_SITES.some((s) => s.key === key))
}

/** Lightweight shape safe to hand to client components. */
export interface PublicSite {
  key: string
  name: string
  description: string
  target: SiteTarget
  blogPath: string
  baseUrl: string
  defaultCategory: string
}

/** The websites a writer may choose between. `wcb` is deliberately not one. */
export const SELECTABLE_SITES: SiteConfig[] = SITES.filter((s) => s.selectable !== false)

/** The website a writer lands on before they have chosen one. */
export const DEFAULT_SELECTABLE_SITE_KEY = SELECTABLE_SITES[0].key

/**
 * Only the selectable websites are handed to the client. This is what the
 * sidebar switcher renders, so a hidden site cannot be picked — and, because
 * the list is also what the client validates against, cannot be forced back
 * in by editing the cookie either.
 */
export function publicSites(): PublicSite[] {
  return SELECTABLE_SITES.map(({ key, name, description, target, blogPath, baseUrl, defaultCategory }) => ({
    key,
    name,
    description,
    target,
    blogPath,
    baseUrl,
    defaultCategory: defaultCategory || 'General',
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
