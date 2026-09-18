/**
 * The single definition of the schema.org structured data a published article
 * emits.
 *
 * Copied **byte-identical** into every site repo, exactly like
 * `articleSeo.ts` and `markdownBlocks.ts`:
 *
 *   whitecollarblogs   src/lib/articleSchema.ts   (the original)
 *   ovopainting        src/lib/articleSchema.ts
 *   durohomes          src/lib/articleSchema.ts
 *   rangerwebsite      src/lib/articleSchema.ts
 *
 * Change it in one repo and you have reintroduced the drift it exists to
 * remove — copy it to all four in the same pass.
 *
 * Why it exists: `articleSeo.ts` made the four sites agree on their meta tags
 * and left structured data untouched, so the four disagreed about whether an
 * article has any at all. Durahome emitted a `BlogPosting` plus a `FAQPage`
 * built by hand in `src/lib/schema.ts`; OVO, Ranger and the CMS emitted
 * **nothing** on an article page. Three of the four were invisible to every
 * rich result Google draws from an article, and the one that was visible
 * claimed an Organization as the author of articles written by a named human.
 * One module means one answer.
 *
 * The field inventory is `blog_cms_schema_reportranger.md`, the CMS data
 * schema spec — the same `BlogPost` shape the three sites already store in
 * `blogData.ts`. What each field becomes:
 *
 *   slug + site.blogPath -> url, @id, mainEntityOfPage, the last breadcrumb
 *   title                -> headline, when there is no metaTitle
 *   metaTitle            -> headline
 *   metaDescription      -> description  (excerpt, then introText[0])
 *   metaKeywords         -> keywords
 *   publishDate          -> datePublished (ISO 8601)
 *   modifiedTime         -> dateModified, falling back to datePublished
 *   readTime             -> timeRequired ("6 min read" -> "PT6M")
 *   category             -> articleSection
 *   author{name,role,image} -> author Person: name, jobTitle, image
 *   heroImage            -> image, an ImageObject
 *   heroImageCaption     -> image.caption  (heroImageAlt is the fallback)
 *   faqs[]               -> a FAQPage node beside the BlogPosting
 *   noindex              -> emits nothing at all
 *
 * plus `breadcrumb`, which is not a CMS field: it is the escape hatch for a
 * site whose articles are not all served directly under `blogPath`.
 *
 * The doc's remaining fields have no counterpart and are deliberately not
 * invented one: `urlSlug` is a per-site path and the canonical is already
 * built from `site.blogPath`, so honouring it would publish OVO's URL in
 * Ranger's markup; `introText`, `keyTakeaways`, `sections` and `conclusion`
 * are the article body, and restating the body inside its own `articleBody`
 * doubles the page weight for a property Google reads off the page anyway.
 *
 * Deliberately runtime-dependency-free — the only import is a type — so it
 * can be copied rather than kept in version lockstep across four package.json
 * files. That is also why the markdown stripper and the URL helper below are
 * private copies rather than imports from `markdownBlocks.ts`: importing it
 * would make this module's four copies depend on that module's four copies
 * staying in step, and a copied file must stand on its own.
 *
 * The export surface is exactly six names — `SchemaSite`,
 * `ArticleSchemaAuthor`, `ArticleSchemaFaq`, `ArticleSchemaInput`,
 * `buildArticleSchema` and `articleSchemaJson` — and everything else is
 * module-private, so a dead-code report here is worth reading. `SchemaSite`
 * is the one exception, for the same reason `articleSeo.ts` has one: only
 * `seoSite.ts` names the type, and a repo that imports the constant rather
 * than the type reports it unused.
 */

import type { ArticleSeoInput, SeoSite } from './articleSeo'

/**
 * What a website is, as far as an article's structured data is concerned.
 *
 * It extends `SeoSite` rather than standing beside it so that a site is still
 * described in exactly one place — each repo's `seoSite.ts`. A second constant
 * holding a second copy of `siteName` and `baseUrl` is the drift this whole
 * family of modules exists to remove.
 */
export interface SchemaSite extends SeoSite {
  /**
   * The publisher's logo. Google wants one on an Article and drops the article
   * from several rich results without it; a site with none emits a `publisher`
   * carrying only a name, which is valid and weaker.
   */
  logo?: string
  /**
   * The publisher's schema.org type. The three painting sites are really a
   * `HomeAndConstructionBusiness`, which is a `LocalBusiness`, which is an
   * `Organization` — so the narrower type is strictly more informative, and
   * `Organization` is the right default for anything that is not a business
   * with a street address.
   */
  organizationType?: string
  /**
   * The label of the blog root in the breadcrumb trail. Derived from the last
   * segment of `blogPath` when unset — "/resources" gives "Resources" — which
   * is right on all four sites today and is only worth setting for a root
   * whose title case is not its own spelling.
   */
  blogLabel?: string
  /**
   * The `@id` of an organization node the site **already emits on this page**,
   * from its root layout. Set it and the graph carries a bare reference to
   * that node instead of describing the publisher again.
   *
   * This is not a nicety. Two nodes sharing an `@id` on one page are one
   * entity to a consumer, which then has to reconcile a full `LocalBusiness`
   * — address, geo, opening hours, founder — against the two-property stub
   * this module would emit. OVO and Durahome both render their organization
   * from `app/layout.tsx`, so it is on every article; Ranger declares one only
   * on its homepage and the CMS declares none, so both of those want the node
   * itself and leave this unset.
   *
   * It must be the id the layout actually writes, character for character.
   * OVO's omits the slash before the "#" while every other site includes it,
   * and an `@id` that differs by one character is a second organization rather
   * than a reference to the first.
   */
  organizationId?: string
  /**
   * The author credited when an article names nobody. Unset, the publisher
   * organization is credited instead, which is what a site with no bylines
   * means and is what Durahome did by hand before this module existed.
   */
  defaultAuthor?: ArticleSchemaAuthor
}

/** A byline. `role` and `image` are the doc's author object, unchanged. */
export interface ArticleSchemaAuthor {
  name: string
  /** "Owner & Lead Craftsman" -> `jobTitle`. */
  role?: string
  /** Profile picture, absolute or root-relative. */
  image?: string
  /** An author page, when the site has one. */
  url?: string
}

/** One question and its answer, as `faqs[]` in the CMS data schema. */
export interface ArticleSchemaFaq {
  question: string
  answer: string
}

/**
 * One article's structured-data inputs, before fallbacks.
 *
 * It extends `ArticleSeoInput` so that the fields the two modules share —
 * title, description, image, dates, canonical — are read from one set of
 * names. A call site that already built an `ArticleSeoInput` for
 * `buildArticleMetadata` spreads it in and adds the rest, which is what makes
 * a `<title>` and a `headline` that disagree impossible.
 */
export interface ArticleSchemaInput extends ArticleSeoInput {
  /** Whole byline. Takes precedence over `authorName`. */
  author?: ArticleSchemaAuthor
  /** `heroImage`'s caption, for the `ImageObject`. */
  heroImageCaption?: string
  /** "Cabinet Painting" -> `articleSection`. */
  category?: string
  /** "6 min read" -> `timeRequired`. */
  readTime?: string
  /** ISO 8601, or anything `Date` can parse. Defaults to `publishedTime`. */
  modifiedTime?: string
  /** Opening paragraphs, read only as the last fallback for `description`. */
  introText?: string[]
  /** Becomes a `FAQPage` node. An empty list emits no node at all. */
  faqs?: ArticleSchemaFaq[]
  /**
   * The breadcrumb trail, when the article is not served directly under
   * `blogPath`. Unset — the normal case — the trail is Home, the blog root,
   * and the article.
   *
   * Durahome is why this exists: its hand-written articles sit at
   * /resources/painting-tips/<slug> and /resources/cost-guides/<slug>, so a
   * trail derived from `blogPath` alone would skip the section a reader
   * actually navigated through and name a page that is one level up. It
   * already computes the real trail from the pathname, and passing it here is
   * what keeps one `BreadcrumbList` on the page instead of two that disagree.
   *
   * The final crumb is the article, so a trail that omits it gets it appended.
   */
  breadcrumb?: { name: string; url: string }[]
}

/** A JSON-LD node. The shape is schema.org's, so the values are unknown. */
type SchemaNode = Record<string, unknown>

/**
 * Descriptions are truncated by every consumer well before this, and a
 * `description` carrying 3,000 words of article is a page-weight cost with no
 * upside. Matches `DESCRIPTION_MAX` in `articleSeo.ts` on purpose: the meta
 * description and the schema description are the same sentence, and two
 * different truncations of it would be two different sentences.
 */
const DESCRIPTION_MAX = 300

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Front matter has no booleans — every value arrives as a quoted string. */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return /^(true|1|yes)$/i.test(clean(value))
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Absolute form of an image or page path.
 *
 * Structured data is read by consumers with no page context — a root-relative
 * "/images/hero.png" in an `ImageObject` is unresolvable to them, and unlike
 * `<img src>` nothing resolves it against the document. Every URL this module
 * emits goes through here.
 */
function absoluteUrl(value: string, baseUrl: string): string {
  const path = clean(value)
  if (!path) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path
  return `${stripTrailingSlash(baseUrl)}${path.startsWith('/') ? '' : '/'}${path}`
}

/** ISO 8601, or '' when the value is not a date at all. */
function toIso(value: unknown): string {
  const raw = clean(value)
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/**
 * Markdown reduced to the plain sentence underneath it.
 *
 * A FAQ answer is prose a writer typed, and the CMS data schema says those
 * strings carry markdown links. JSON-LD has no markup: left in, a rich result
 * shows a reader the literal "[our cost guide](/resources/cost)" instead of
 * the words. Emphasis, inline code, images and headings get the same
 * treatment for the same reason.
 *
 * This is a stripper, not a parser — it never has to *render* anything, only
 * to stop markup reaching a consumer, so the handful of syntaxes a writer
 * actually types in an answer is the whole job.
 */
function plainText(value: unknown): string {
  return clean(value)
    // Images first: `![alt](url)` would otherwise leave a stray "!" behind
    // when the link rule below consumed its `[alt](url)` half.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // The serializer escapes markup in ordinary text, so a stored answer can
    // carry "\*" for a literal asterisk. Unescape before stripping, or the
    // backslash is what survives into the rich result.
    .replace(/\\([\\`*_~[\]<>#|-])/g, '$1')
    .replace(/(\*\*\*|___)(.+?)\1/g, '$2')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "6 min read" -> "PT6M", the ISO 8601 duration `timeRequired` takes.
 *
 * The printed string is what a template shows a reader and the only form the
 * CMS stores, so the number is parsed back out of it rather than held twice.
 * A value with no number in it — "a quick read" — yields nothing, because a
 * `timeRequired` that guesses is worse than an absent one.
 */
function toDuration(value: unknown): string {
  const minutes = clean(value).match(/(\d+)/)
  return minutes ? `PT${Number(minutes[1])}M` : ''
}

/** "en_US" -> "en-US". Schema.org takes a BCP 47 tag; og:locale does not. */
function toLanguageTag(locale: string | undefined): string {
  return (clean(locale) || 'en_US').replace(/_/g, '-')
}

/** The URL this article is served from — its canonical, and its node ids. */
function articleUrl(slug: string, site: SchemaSite): string {
  const path = `${stripTrailingSlash(site.blogPath)}/${clean(slug)}`
  return `${stripTrailingSlash(site.baseUrl)}${path}${site.trailingSlash ? '/' : ''}`
}

/** The blog root, for the middle breadcrumb. */
function blogRootUrl(site: SchemaSite): string {
  const path = stripTrailingSlash(site.blogPath)
  return `${stripTrailingSlash(site.baseUrl)}${path}${site.trailingSlash ? '/' : ''}`
}

/** "/resources" -> "Resources". Only the last segment is the label. */
function blogRootLabel(site: SchemaSite): string {
  const explicit = clean(site.blogLabel)
  if (explicit) return explicit
  const segment = stripTrailingSlash(site.blogPath).split('/').filter(Boolean).pop() || ''
  return segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** The `@id` every node points at when it names the publisher. */
function organizationId(site: SchemaSite): string {
  return clean(site.organizationId) || `${stripTrailingSlash(site.baseUrl)}/#organization`
}

/**
 * The publisher node, or `null` when the site's own layout already emits one
 * on this page and `organizationId` points at it.
 */
function organizationNode(site: SchemaSite): SchemaNode | null {
  if (clean(site.organizationId)) return null

  const baseUrl = stripTrailingSlash(site.baseUrl)
  const logo = absoluteUrl(clean(site.logo), baseUrl)

  return {
    '@type': clean(site.organizationType) || 'Organization',
    '@id': organizationId(site),
    name: site.siteName,
    url: `${baseUrl}/`,
    // A bare string is valid here, but `logo` is the one property Google
    // documents as an ImageObject on a publisher, and the `@type` is what
    // lets it be reused as the organization's `image`.
    ...(logo ? { logo: { '@type': 'ImageObject', url: logo }, image: logo } : {}),
  }
}

/**
 * The byline.
 *
 * A named human is a `Person`; with no name anywhere, the article is credited
 * to the publisher, which is what a site with no bylines actually means. The
 * alternative — a `Person` named after the company — tells a consumer that a
 * business is a human being.
 */
function authorNode(input: ArticleSchemaInput, site: SchemaSite): SchemaNode {
  const byline = input.author || (clean(input.authorName) ? { name: clean(input.authorName) } : site.defaultAuthor)
  const name = clean(byline?.name)
  if (!name) return { '@id': organizationId(site) }

  const role = clean(byline?.role)
  const image = absoluteUrl(clean(byline?.image), site.baseUrl)
  const url = absoluteUrl(clean(byline?.url), site.baseUrl)

  return {
    '@type': 'Person',
    name,
    ...(role ? { jobTitle: role } : {}),
    ...(image ? { image } : {}),
    ...(url ? { url } : {}),
  }
}

/** The article itself. */
function blogPostingNode(input: ArticleSchemaInput, site: SchemaSite, url: string): SchemaNode {
  const baseUrl = stripTrailingSlash(site.baseUrl)
  const title = clean(input.title) || clean(input.slug).replace(/-/g, ' ')
  const headline = plainText(clean(input.metaTitle) || title)

  const description = plainText(
    clean(input.metaDescription) || clean(input.excerpt) || clean(input.introText?.[0]),
  ).slice(0, DESCRIPTION_MAX)

  const image = absoluteUrl(clean(input.ogImage) || clean(input.heroImage) || clean(site.defaultOgImage), baseUrl)
  const caption = plainText(clean(input.heroImageCaption) || clean(input.heroImageAlt))

  const published = toIso(input.publishedTime)
  // `dateModified` defaults to `datePublished` rather than to "now": a build
  // timestamp would tell every consumer the article changed on every deploy,
  // which is exactly the signal the property exists to carry.
  const modified = toIso(input.modifiedTime) || published

  const keywords = clean(input.metaKeywords)
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)

  const timeRequired = toDuration(input.readTime)
  const section = plainText(input.category)

  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline,
    ...(description ? { description } : {}),
    ...(image
      ? { image: { '@type': 'ImageObject', url: image, ...(caption ? { caption } : {}) } }
      : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: authorNode(input, site),
    publisher: { '@id': organizationId(site) },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    ...(section ? { articleSection: section } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(timeRequired ? { timeRequired } : {}),
    inLanguage: toLanguageTag(site.locale),
  }
}

/**
 * The FAQ accordion, as the `FAQPage` that draws it as a rich result.
 *
 * Only emitted when there are real questions: a `FAQPage` whose `mainEntity`
 * is empty is a structured-data error, and every article without an FAQ would
 * carry one.
 */
function faqNode(faqs: ArticleSchemaFaq[], url: string): SchemaNode | null {
  const items = faqs
    .map((faq) => ({ question: plainText(faq?.question), answer: plainText(faq?.answer) }))
    .filter((faq) => faq.question && faq.answer)

  if (!items.length) return null

  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: items.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
}

/** Home > Resources > this article, unless the site supplied its own trail. */
function breadcrumbNode(input: ArticleSchemaInput, site: SchemaSite, url: string): SchemaNode {
  const baseUrl = stripTrailingSlash(site.baseUrl)
  const title = plainText(clean(input.title) || clean(input.slug).replace(/-/g, ' '))

  const supplied = (input.breadcrumb || [])
    .map((crumb) => ({ name: plainText(crumb?.name), item: absoluteUrl(clean(crumb?.url), baseUrl) }))
    .filter((crumb) => crumb.name && crumb.item)

  const trail = supplied.length
    ? // A supplied trail that already ends on this article keeps its URLs and
      // takes the article's real title for that last crumb; one that stops at
      // the section gets the article appended. Either way a caller never has
      // to know whether its own helper included the leaf.
      //
      // The name is overwritten rather than trusted because a helper that
      // derives a trail from a pathname can only title-case the slug:
      // Durahome's produced "Cabinet Painting Vs Refinishing What S The
      // Difference" for an article actually called "Cabinet Painting vs
      // Refinishing: What's the Difference?". The URL it built was right; the
      // name never can be.
      supplied[supplied.length - 1].item === url
      ? [...supplied.slice(0, -1), { name: title, item: url }]
      : [...supplied, { name: title, item: url }]
    : [
        { name: 'Home', item: `${baseUrl}/` },
        { name: blogRootLabel(site), item: blogRootUrl(site) },
        { name: title, item: url },
      ]

  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  }
}

/**
 * The whole graph for one article, or `null` when it must not be described.
 *
 * One `@graph` rather than three separate scripts, so the nodes can reference
 * each other by `@id` — the publisher is written once and pointed at, instead
 * of being repeated in full inside every node that mentions it.
 *
 * A noindexed article emits nothing at all. Structured data is a request to be
 * shown in a result; emitting it on a page that has just asked not to be
 * indexed is the page contradicting itself, and the contradiction is resolved
 * in whichever direction the consumer prefers.
 */
export function buildArticleSchema(input: ArticleSchemaInput, site: SchemaSite): SchemaNode | null {
  if (toBoolean(input.noindex)) return null

  const url = clean(input.canonicalUrl) || articleUrl(input.slug, site)
  const organization = organizationNode(site)
  const faq = faqNode(input.faqs || [], url)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...(organization ? [organization] : []),
      blogPostingNode(input, site, url),
      ...(faq ? [faq] : []),
      breadcrumbNode(input, site, url),
    ],
  }
}

/**
 * The graph as the string a `<script type="application/ld+json">` carries, or
 * '' when there is nothing to emit.
 *
 * The escaping is the reason this exists rather than each site calling
 * `JSON.stringify` itself — which is what all three were doing on their other
 * schema blocks. `</script>` inside a JSON string ends the script element as
 * far as an HTML parser is concerned, and everything after it is parsed as
 * markup: an article whose FAQ answer quotes a closing script tag becomes an
 * injection point. Escaping "<" makes that unrepresentable, and `<` is
 * the same string to a JSON parser, so no consumer can tell the difference.
 * "&" and the two line separators are escaped for the same class of reason —
 * U+2028 and U+2029 are literal newlines to a JavaScript parser, though not
 * to a JSON one.
 */
export function articleSchemaJson(input: ArticleSchemaInput, site: SchemaSite): string {
  const schema = buildArticleSchema(input, site)
  if (!schema) return ''

  return JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
