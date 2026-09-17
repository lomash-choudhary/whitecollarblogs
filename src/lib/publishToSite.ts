/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ships a published CMS post to an external website by triggering that
 * website's GitHub Action (`repository_dispatch`).
 *
 * The Action receives the finished markdown file (base64 encoded, so nothing
 * can be mangled by JSON escaping), writes it into the site repo, commits it
 * and lets Vercel redeploy. Sitemap + blog listing on the target site are
 * generated from that content folder, so both update on their own.
 */

import { DISPATCH_EVENT_TYPE, getSite, missingSiteEnv, type SiteConfig } from '@/config/sites'
import { lexicalToMarkdown } from '@/utils/lexicalToMarkdown'
import { firstParagraphText, parseMarkdownBlocks } from './markdownBlocks'
import { buildMarkdownFile, slugify, type Frontmatter } from './markdownFile'
import { findImagePlaceholders } from './imagePlaceholders'
import { cleanImageUrl } from '@/utils/cleanImageUrl'

/**
 * The dispatch runs inside the save transaction, so it must not hang and hold
 * one of the three pool connections open while GitHub is slow or unreachable.
 */
const DISPATCH_TIMEOUT_MS = 15_000

export interface PublishResult {
  ok: boolean
  status: 'dispatched' | 'skipped' | 'failed'
  message: string
  liveUrl?: string
  fileName?: string
}

/** ISO 8601, for `article:published_time`. Empty when the date is unusable. */
function isoPublishDate(value: any): string {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function formatPublishDate(value: any): string {
  const date = value ? new Date(value) : new Date()
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  return safe.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * First real paragraph of the article, for the excerpt and meta description.
 *
 * Parsed rather than pattern-matched on raw lines: a post that opens with a
 * code fence, a callout or a Key Takeaways box has no line the old prefix
 * checks recognised, so the excerpt came out as a stray ":::" or a bare "```".
 */
function firstParagraph(markdown: string): string {
  return firstParagraphText(parseMarkdownBlocks(markdown)).slice(0, 300)
}

/**
 * The article's feature image, lifted out of the body to become the hero.
 *
 * The SEO team's brief says "Feature image (below H1, above intro)", and the
 * generated image lands on exactly that line — which is the hero slot every
 * template already draws, one block earlier. Left in the body it rendered
 * *below* the hero, so the article showed two pictures: the site's generic
 * fallback at the top and the real one under it. Worse on OVO, where the
 * fallback pointed at a file that does not exist and the top of every
 * published article was a broken-image icon.
 *
 * **Only an image written above the prose is taken.** The walk stops at the
 * first block that is not a heading or an image, so a picture a writer placed
 * in the middle of the article stays exactly where they put it. Hoisting one
 * of those would be the named-slot mistake the parser rules warn about: the
 * hero is a slot, and a slot that reaches into the flow reorders the article.
 */
function liftFeatureImage(markdown: string): { url: string; alt: string; body: string } | null {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue

    const block = parseMarkdownBlocks(line)[0]
    if (!block) continue
    if (block.type === 'heading') continue
    if (block.type !== 'image') return null

    // The blank line under it goes too, or the lift leaves a double gap.
    const drop = lines[i + 1] !== undefined && lines[i + 1].trim() === '' ? 2 : 1
    const rest = [...lines.slice(0, i), ...lines.slice(i + drop)]
    return {
      url: block.url,
      alt: block.alt || '',
      body: rest.join('\n').replace(/^\n+/, ''),
    }
  }

  return null
}

/**
 * Converts a Payload post document into the markdown file contents the
 * target website expects. Exported so it can be previewed/tested without
 * actually calling GitHub.
 */
export function buildPostMarkdown(
  post: any,
  site: SiteConfig,
  author?: any,
): { slug: string; fileName: string; content: string } {
  const rawBody = typeof post.content === 'string' ? post.content : lexicalToMarkdown(post.content)
  const slug = slugify(post.slug || post.title)

  // The cover image box wins when a writer filled it in; otherwise the
  // article's own feature image is the hero, and is taken out of the body so
  // the page does not show it twice. The site default is the last resort, for
  // an article that has neither.
  const uploaded = cleanImageUrl(post.coverImageUrl) || post.resolvedCoverImageUrl || ''
  const feature = uploaded ? null : liftFeatureImage(rawBody)
  const body = feature ? feature.body : rawBody
  const heroImage = uploaded || feature?.url || site.defaultHeroImage || ''

  const excerpt = (post.excerpt || '').trim() || firstParagraph(body)
  const metaTitle = (post.metaTitle || '').trim() || post.title
  const metaDescription = (post.metaDescription || '').trim() || excerpt
  // The feature image's own alt text describes the picture; the title does
  // not. Prefer it over the title whenever that image is the hero.
  const heroImageAlt = (post.coverImageAlt || '').trim() || feature?.alt || post.title

  const frontmatter: Frontmatter = {
    slug,
    title: post.title,
    metaTitle,
    metaDescription,
    excerpt,
    category: post.targetRole || site.defaultCategory || 'Guides',
    targetKeyword: post.targetKeyword || post.title,
    publishDate: formatPublishDate(post.publishDate),
    // The machine-readable twin of publishDate. `article:published_time` wants
    // ISO 8601; the printed form above is what a template shows a reader, and
    // OVO was putting that straight into the tag, where it is ignored.
    publishedTime: isoPublishDate(post.publishDate),
    readTime: post.readTime || '5 min read',
    heroImage,
    heroImageAlt,
    heroImageCaption: excerpt,
    // The SEO box. Written unconditionally rather than only when set: an empty
    // value is dropped by buildMarkdownFile, so clearing a field in the CMS
    // removes the key from the file and the site falls back again.
    metaKeywords: (post.metaKeywords || '').trim(),
    canonicalUrl: (post.canonicalUrl || '').trim(),
    ogImage: cleanImageUrl(post.ogImageUrl) || '',
    // No `ogImageAlt` key: it falls back to `heroImageAlt` in every reader, so
    // writing the same string twice would only be a second place to go stale.
    authorName: author?.name || 'Editorial Team',
    authorRole: author?.role || 'Contributor',
    authorImage: cleanImageUrl(author?.avatar) || '',
    source: 'whitecollarblogs',
    sourceId: String(post.id ?? ''),
    updatedAt: new Date().toISOString(),
  }

  return {
    slug,
    fileName: `${slug}.md`,
    content: buildMarkdownFile(frontmatter, body),
  }
}

/**
 * Fires the target repo's workflow. Returns a result instead of throwing so a
 * failed publish never blocks saving the post in the CMS.
 */
export async function publishPostToSite(post: any, author?: any): Promise<PublishResult> {
  const site = getSite(post?.site)

  if (site.target !== 'github' || !site.github) {
    return { ok: true, status: 'skipped', message: `"${site.name}" is served by this CMS directly — nothing to dispatch.` }
  }

  // Repo coordinates and the token all come from this site's env vars, so one
  // check covers them: without them there is nowhere to send the article.
  const missing = missingSiteEnv(site)
  if (missing.length > 0) {
    return {
      ok: false,
      status: 'failed',
      message: `${site.name} is not configured yet — set ${missing.join(
        ', ',
      )} in this app's environment, then publish again. The post itself is saved.`,
    }
  }

  const token = process.env[site.github.tokenEnv] as string
  const { slug, fileName, content } = buildPostMarkdown(post, site, author)

  // An unresolved image tag is ordinary bracketed text to the parser, so it
  // would ship to the live site as a visible paragraph reading "[Feature image
  // — below H1 …]". Refusing here is the last point where a writer can still be
  // told; the site itself has no idea the line was meant to be a picture.
  const unresolved = findImagePlaceholders(content)
  if (unresolved.length > 0) {
    return {
      ok: false,
      status: 'failed',
      message: `${unresolved.length} image ${
        unresolved.length === 1 ? 'tag has' : 'tags have'
      } not been generated yet (${unresolved
        .map((p) => p.label)
        .join(', ')}). Open the post and press "Generate images" in the editor toolbar, then publish again. The post itself is saved.`,
    }
  }

  const { owner, repo } = site.github
  const liveUrl = site.baseUrl
    ? `${site.baseUrl.replace(/\/$/, '')}${site.blogPath}/${slug}`
    : undefined

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'whitecollarblogs-cms',
      },
      body: JSON.stringify({
        event_type: DISPATCH_EVENT_TYPE,
        client_payload: {
          slug,
          file_name: fileName,
          title: String(post.title || ''),
          // No branch: the workflow runs on, and commits to, the receiving
          // repo's default branch whatever we send.
          // base64 keeps the markdown byte-identical through JSON + shell.
          content_base64: Buffer.from(content, 'utf8').toString('base64'),
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return {
        ok: false,
        status: 'failed',
        message: `GitHub rejected the dispatch (${response.status}). ${detail.slice(0, 300)}`,
        fileName,
      }
    }

    return {
      ok: true,
      status: 'dispatched',
      message: `Sent to ${owner}/${repo}. The site rebuilds in a couple of minutes.`,
      liveUrl,
      fileName,
    }
  } catch (err: any) {
    const reason =
      err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `GitHub did not respond within ${DISPATCH_TIMEOUT_MS / 1000} seconds.`
        : err?.message || 'unknown network error'
    return {
      ok: false,
      status: 'failed',
      message: `Could not reach GitHub: ${reason}`,
      fileName,
    }
  }
}
