/**
 * The single definition of what meta tags a published article emits.
 *
 * Copied **byte-identical** into every site repo, exactly like
 * `markdownBlocks.ts`:
 *
 *   whitecollarblogs   src/lib/articleSeo.ts   (the original)
 *   ovopainting        src/lib/articleSeo.ts
 *   durohomes          src/lib/articleSeo.ts
 *   rangerwebsite      src/lib/articleSeo.ts
 *
 * Change it in one repo and you have reintroduced the drift it exists to
 * remove — copy it to all four in the same pass.
 *
 * Why it exists: before this, every site built its own `generateMetadata` by
 * hand, so the four production sites disagreed about which tags an article
 * even has. OVO and Ranger emitted `article:published_time`, Durahome and
 * White Collar Advice did not; Durahome was the only one with `keywords`;
 * only White Collar Advice had `og:site_name`; and **all four** shipped the
 * site-wide homepage copy as `twitter:title` / `twitter:description` on every
 * article, because a page that sets `openGraph` but not `twitter` inherits the
 * root layout's Twitter card untouched. One module means one answer.
 *
 * Deliberately runtime-dependency-free (a type-only `next` import) so it can
 * be copied rather than kept in version lockstep across four package.json
 * files.
 *
 * The front-matter keys it reads — the contract between the CMS's
 * `publishToSite.ts` and every site's `markdownBlog.ts` — are `metaTitle`,
 * `metaDescription`, `metaKeywords`, `canonicalUrl`, `noindex`, `ogImage`,
 * `ogImageAlt` and `publishedTime`, plus the `heroImage`, `heroImageAlt`,
 * `authorName`, `title`, `excerpt` and `publishDate` the sites already wrote.
 * `seoInputFromFrontmatter` is the only place those names appear, so a site
 * that reads `title` where the CMS writes `metaTitle` is not possible.
 *
 * The export surface is exactly five names — `SeoSite`, `ArticleSeoInput`,
 * `buildArticleMetadata`, `seoInputFromFrontmatter` and `toIsoDate` — and
 * everything else
 * is module-private, so a dead-code report here is worth reading. With one
 * exception, the same one `markdownBlocks.ts` has: `seoInputFromFrontmatter`
 * reads markdown front matter, which only the three websites do, so the CMS's
 * own dead-code report calls it unused and is wrong. Each repo sees only its
 * own consumers; the surface is the union of all four.
 */

import type { Metadata } from 'next'

/** What a website is, as far as an article's meta tags are concerned. */
export interface SeoSite {
  /** `og:site_name`, and the suffix appended to `<title>`. */
  siteName: string
  /** Public origin, no trailing slash: "https://www.ovopainting.com". */
  baseUrl: string
  /** Where this site serves CMS articles from, e.g. "/resources". */
  blogPath: string
  /**
   * Durahome builds with `trailingSlash: true`, so its canonical URLs end in
   * "/". A canonical that disagrees with the URL the site actually serves is
   * a self-referencing canonical pointing at a redirect.
   */
  trailingSlash?: boolean
  /** `og:locale`. */
  locale?: string
  /** Used for `og:image` when the article has no cover image of its own. */
  defaultOgImage?: string
}

/**
 * One article's SEO inputs, before fallbacks. Every field is optional except
 * the two that always exist, so the same function reads a markdown file's
 * front matter and a Payload document.
 */
export interface ArticleSeoInput {
  slug: string
  title: string
  excerpt?: string
  heroImage?: string
  heroImageAlt?: string
  authorName?: string
  metaTitle?: string
  metaDescription?: string
  /** Comma-separated, the way a writer types it into one box. */
  metaKeywords?: string
  canonicalUrl?: string
  /** `"true"` from front matter, a real boolean from Payload. */
  noindex?: string | boolean
  ogImage?: string
  ogImageAlt?: string
  /** ISO 8601. */
  publishedTime?: string
}

/** Every value resolved — no more fallbacks left to apply. */
interface ArticleSeo {
  metaTitle: string
  metaDescription: string
  metaKeywords: string[]
  canonicalUrl: string
  noindex: boolean
  ogImage: string
  ogImageAlt: string
  publishedTime: string
  authorName: string
}

/** Meta descriptions are truncated by every search engine well before this. */
const DESCRIPTION_MAX = 300

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Front matter has no booleans — every value arrives as a quoted string. */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return /^(true|1|yes)$/i.test(clean(value))
}

/** "a, b ,, c" -> ["a", "b", "c"]. An empty box means no `keywords` tag. */
function parseKeywords(value: unknown): string[] {
  return clean(value)
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)
}

/**
 * ISO 8601, or '' when the value is not a date at all.
 *
 * `article:published_time` is normalised rather than passed through because
 * the value can arrive in either of two shapes. Articles published before
 * `publishedTime` existed have only the printed `publishDate` ("July 31,
 * 2026"), which OVO was emitting verbatim into the tag — well-formed HTML
 * carrying a value no consumer can read. Parsing it here means those files
 * become correct without being re-published.
 */
export function toIsoDate(value: unknown): string {
  const raw = clean(value)
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Absolute form of an image or page path.
 *
 * `og:image` is read by scrapers that have no page context, so a root-relative
 * "/images/hero.png" is useless to them. Next would resolve it against
 * `metadataBase`, but only three of the four apps set one — doing it here
 * means the same input produces the same tag everywhere.
 */
function absoluteUrl(value: string, baseUrl: string): string {
  const path = clean(value)
  if (!path) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path
  return `${stripTrailingSlash(baseUrl)}${path.startsWith('/') ? '' : '/'}${path}`
}

/** The URL this article is served from — also its canonical and its og:url. */
function articleUrl(slug: string, site: SeoSite): string {
  const path = `${stripTrailingSlash(site.blogPath)}/${clean(slug)}`
  return `${stripTrailingSlash(site.baseUrl)}${path}${site.trailingSlash ? '/' : ''}`
}

/**
 * `<title>`, which carries the site name; `og:title` and `twitter:title` do
 * not, because `og:site_name` already tells a social card which site it is and
 * repeating it eats the ~60 characters a card actually shows.
 *
 * The suffix is skipped when the writer already typed it, so a meta title
 * copied out of an existing page does not come back as
 * "… | Ranger Painting | Ranger Painting".
 */
function pageTitle(metaTitle: string, site: SeoSite): string {
  const title = clean(metaTitle)
  const suffix = clean(site.siteName)
  if (!suffix) return title
  const lower = title.toLowerCase()
  if (lower === suffix.toLowerCase() || lower.endsWith(`| ${suffix.toLowerCase()}`)) return title
  return `${title} | ${suffix}`
}

/**
 * Applies every fallback exactly once, so a template never has to guess which
 * of `metaDescription`, `excerpt` or the first paragraph it should reach for.
 */
function resolveArticleSeo(input: ArticleSeoInput, site: SeoSite): ArticleSeo {
  const title = clean(input.title) || clean(input.slug).replace(/-/g, ' ')
  const excerpt = clean(input.excerpt)
  const metaTitle = clean(input.metaTitle) || title
  const metaDescription = (clean(input.metaDescription) || excerpt).slice(0, DESCRIPTION_MAX)

  const heroImage = clean(input.heroImage)
  const ogImage = clean(input.ogImage) || heroImage || clean(site.defaultOgImage)

  return {
    metaTitle,
    metaDescription,
    metaKeywords: parseKeywords(input.metaKeywords),
    canonicalUrl: clean(input.canonicalUrl) || articleUrl(input.slug, site),
    noindex: toBoolean(input.noindex),
    ogImage: absoluteUrl(ogImage, site.baseUrl),
    // The alt text of the share card falls back to the cover image's own alt
    // before the title, so a writer who described the picture once does not
    // have to describe it again.
    ogImageAlt: clean(input.ogImageAlt) || clean(input.heroImageAlt) || metaTitle,
    publishedTime: toIsoDate(input.publishedTime),
    authorName: clean(input.authorName),
  }
}

/**
 * The Next.js `Metadata` for one article — the same tag set on all four sites.
 *
 * `twitter` is always set, never left to cascade. Next merges metadata field
 * by field, so a page that sets only `openGraph` keeps the root layout's
 * Twitter card: every article on all four production sites was sharing the
 * *homepage* headline and blurb on X, which is invisible in the page and
 * unmissable in a shared link.
 */
function articleMetadata(seo: ArticleSeo, site: SeoSite): Metadata {
  const images = seo.ogImage ? [{ url: seo.ogImage, alt: seo.ogImageAlt }] : undefined

  return {
    title: pageTitle(seo.metaTitle, site),
    description: seo.metaDescription,
    // The key is spread in, not set to `undefined`. Next resolves metadata by
    // walking the keys a segment actually declares, so `keywords: undefined`
    // is a declaration that shadows the root layout's site-wide keywords with
    // nothing — an article with an empty keywords box would strip Durahome's.
    // Omitting the key lets the parent's value through, which is the fallback
    // the CMS's help text promises.
    ...(seo.metaKeywords.length ? { keywords: seo.metaKeywords } : {}),
    alternates: { canonical: seo.canonicalUrl },
    robots: seo.noindex
      ? { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } }
      : { index: true, follow: true },
    openGraph: {
      type: 'article',
      title: seo.metaTitle,
      description: seo.metaDescription,
      url: seo.canonicalUrl,
      siteName: site.siteName,
      locale: site.locale || 'en_US',
      // `article:published_time` only renders when `type` is "article", and
      // only accepts ISO 8601 — a printed date like "July 31, 2026" is emitted
      // verbatim and silently ignored by every consumer.
      publishedTime: seo.publishedTime || undefined,
      authors: seo.authorName ? [seo.authorName] : undefined,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.metaTitle,
      description: seo.metaDescription,
      images,
    },
  }
}

/** The usual one-liner: resolve then build. */
export function buildArticleMetadata(input: ArticleSeoInput, site: SeoSite): Metadata {
  return articleMetadata(resolveArticleSeo(input, site), site)
}

/**
 * Reads the SEO front matter the CMS writes into an `ArticleSeoInput`, with
 * the article's own fields as the fallbacks.
 *
 * This exists so three separate `markdownBlog.ts` files cannot each decide a
 * slightly different key name. `heroImageAlt` and `authorName` are read here
 * too even though they are not SEO-only keys — they are what `og:image:alt`
 * and `article:author` fall back to, and a site that forgot to pass them
 * published the title as the alt text of every share image.
 */
export function seoInputFromFrontmatter(
  data: Record<string, string | undefined>,
  article: {
    slug: string
    title: string
    excerpt?: string
    heroImage?: string
    authorName?: string
  },
): ArticleSeoInput {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    heroImage: article.heroImage,
    heroImageAlt: data.heroImageAlt,
    authorName: data.authorName || article.authorName,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    metaKeywords: data.metaKeywords,
    canonicalUrl: data.canonicalUrl,
    noindex: data.noindex,
    ogImage: data.ogImage,
    ogImageAlt: data.ogImageAlt,
    // `publishDate` is the fallback, not a second source of truth: a file
    // published before `publishedTime` existed has only the printed date, and
    // `toIsoDate` turns it into a valid tag rather than dropping it.
    publishedTime: data.publishedTime || data.publishDate,
  }
}
