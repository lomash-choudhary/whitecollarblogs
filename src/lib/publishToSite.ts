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

import { getSite, type SiteConfig } from '@/config/sites'
import { lexicalToMarkdown } from '@/utils/lexicalToMarkdown'
import { buildMarkdownFile, slugify, type Frontmatter } from './markdownFile'
import { cleanImageUrl } from '@/utils/cleanImageUrl'

export interface PublishResult {
  ok: boolean
  status: 'dispatched' | 'skipped' | 'failed'
  message: string
  liveUrl?: string
  fileName?: string
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

function firstParagraph(markdown: string): string {
  const para = markdown
    .split('\n\n')
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#') && !block.startsWith('|') && !block.startsWith('!['))
  return para ? para.replace(/\s+/g, ' ').slice(0, 300) : ''
}

/**
 * Converts a Payload post document into the markdown file contents the
 * target website expects. Exported so it can be previewed/tested without
 * actually calling GitHub.
 */
export function buildPostMarkdown(post: any, site: SiteConfig, author?: any): { fileName: string; content: string } {
  const body = typeof post.content === 'string' ? post.content : lexicalToMarkdown(post.content)
  const slug = slugify(post.slug || post.title)
  const excerpt = (post.excerpt || '').trim() || firstParagraph(body)
  const heroImage = cleanImageUrl(post.coverImageUrl) || post.resolvedCoverImageUrl || site.defaultHeroImage || ''

  const frontmatter: Frontmatter = {
    slug,
    title: post.title,
    metaTitle: post.metaTitle || post.title,
    metaDescription: excerpt,
    excerpt,
    category: post.targetRole || site.defaultCategory || 'Guides',
    targetKeyword: post.targetKeyword || post.title,
    publishDate: formatPublishDate(post.publishDate),
    readTime: post.readTime || '5 min read',
    heroImage,
    heroImageAlt: post.title,
    heroImageCaption: excerpt,
    authorName: author?.name || 'Editorial Team',
    authorRole: author?.role || 'Contributor',
    authorImage: cleanImageUrl(author?.avatar) || '',
    source: 'whitecollarblogs',
    sourceId: String(post.id ?? ''),
    updatedAt: new Date().toISOString(),
  }

  return {
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

  const token = process.env[site.github.tokenEnv]
  if (!token) {
    return {
      ok: false,
      status: 'failed',
      message: `Missing ${site.github.tokenEnv} env var — cannot reach the ${site.name} repository.`,
    }
  }

  const { fileName, content } = buildPostMarkdown(post, site, author)
  const { owner, repo, branch, eventType } = site.github
  const liveUrl = `${site.baseUrl.replace(/\/$/, '')}${site.blogPath}/${fileName.replace(/\.md$/, '')}`

  try {
    // Overridable so the dispatch can be pointed at a local stub in tests.
    const apiBase = (process.env.GITHUB_API_BASE_URL || 'https://api.github.com').replace(/\/$/, '')
    // This call happens inside the save transaction, so it must not hang and
    // hold a database connection open if GitHub is slow or unreachable.
    const response = await fetch(`${apiBase}/repos/${owner}/${repo}/dispatches`, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'whitecollarblogs-cms',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          slug: fileName.replace(/\.md$/, ''),
          file_name: fileName,
          title: String(post.title || ''),
          branch,
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
        ? 'GitHub did not respond within 15 seconds.'
        : err?.message || 'unknown network error'
    return {
      ok: false,
      status: 'failed',
      message: `Could not reach GitHub: ${reason}`,
      fileName,
    }
  }
}
