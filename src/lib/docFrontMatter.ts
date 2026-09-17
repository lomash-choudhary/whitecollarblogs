/**
 * The block of SEO metadata a Google Docs export opens with, read into the
 * fields it was always meant to fill.
 *
 * The SEO team hands over a `.docx`; a writer opens it in Google Docs and
 * downloads the markdown. Every one of those exports opens with the same
 * preamble — a topic line, a keyword list, a meta title, a meta description
 * and a URL slug — and then the article's own `# Title`:
 *
 *     Topic - How to Choose the Right Paint Finish (rewrite)
 *
 *     Keywords -
 *     how to choose paint finish
 *     types of finish for paint, paint finish comparison
 *
 *     Meta Title: How to Choose the Right Paint Finish: Full 2026 Guide
 *     Meta Description: See how to choose the right paint finish for …
 *     URL Slug: /blog/how-to-choose-the-right-paint-finish
 *
 *     # **(H1) How to Choose the Right Paint Finish**
 *
 * None of that is article copy, and until this module existed none of it was
 * consumed. Pasted straight into the body it published as the article's first
 * sixteen paragraphs — the copy written *for* the meta description sitting on
 * the page instead of in the tag, while `metaTitle` and `metaDescription`
 * stayed empty and every tag fell back to the title and the excerpt. The
 * leading `# Title` published as a second `<h1>` directly under the page's own
 * title, on all four sites.
 *
 * So this is an **importer, not a parser feature**. It runs once, in the
 * editor, on the text the writer pastes; it rewrites that text and fills the
 * form fields beside it. Nothing here reaches `markdownBlocks.ts` and no site
 * renderer changes — exactly like `imagePlaceholders.ts`, and for the same
 * reason: this is one team's document convention, not a new meaning for
 * markdown.
 *
 * Two spellings of the same block are in circulation and both have to be read,
 * because both arrive. The one above is plain labels on their own lines; the
 * other bolds the labels, parenthesises a character count, and runs all three
 * onto a single line above a `---` fence:
 *
 *     **Meta Title (55 chars):** Cabinet Painting vs Refinishing: Key
 *     Differences (2026) **Meta Description (154 chars):** Cabinet painting
 *     vs refinishing … **URL Slug:** /blog/cabinet-painting-vs-refinishing
 *
 *     ---
 */

import { parseMarkdownBlocks } from './markdownBlocks'
import { findImagePlaceholders } from './imagePlaceholders'

/**
 * The labels this module knows, and the field each one fills.
 *
 * It is a **closed list on purpose**. Matching any `**Something:**` line would
 * swallow the image brief that sits in this very preamble —
 * `**Feature image (below H1, above intro):** Alt text: …` is a bold label
 * followed by a colon and is not metadata — and would turn a writer's bold
 * lead-in into a silently deleted paragraph. A label nobody has seen in a real
 * draft is better missed than guessed: a missed label leaves a visible
 * paragraph the writer can move by hand, a wrong one deletes their copy.
 */
const LABELS = {
  topic: 'topic',
  keywords: 'keywords',
  metaTitle: 'metaTitle',
  metaDescription: 'metaDescription',
  slug: 'slug',
  targetKeyword: 'targetKeyword',
  canonicalUrl: 'canonicalUrl',
  coverImageAlt: 'coverImageAlt',
  ogImageUrl: 'ogImageUrl',
} as const

type LabelKey = (typeof LABELS)[keyof typeof LABELS]

const LABEL_ALIASES: { pattern: string; key: LabelKey }[] = [
  { pattern: 'topic', key: LABELS.topic },
  { pattern: 'keywords?', key: LABELS.keywords },
  { pattern: 'meta\\s*titles?', key: LABELS.metaTitle },
  { pattern: 'seo\\s*titles?', key: LABELS.metaTitle },
  { pattern: 'titles?\\s*tag', key: LABELS.metaTitle },
  { pattern: 'meta\\s*desc(?:ription)?s?', key: LABELS.metaDescription },
  { pattern: 'seo\\s*desc(?:ription)?s?', key: LABELS.metaDescription },
  { pattern: 'url\\s*slugs?', key: LABELS.slug },
  { pattern: 'slugs?', key: LABELS.slug },
  { pattern: 'primary\\s*keywords?', key: LABELS.targetKeyword },
  { pattern: 'target\\s*keywords?', key: LABELS.targetKeyword },
  { pattern: 'focus\\s*keywords?', key: LABELS.targetKeyword },
  { pattern: 'canonical(?:\\s*urls?)?', key: LABELS.canonicalUrl },
  // Written by nobody's template — these two exist so the block the editor
  // keeps at the top of the body can carry every SEO field, not just the five
  // the SEO team writes. Spelled out in full on purpose: a bare `alt text`
  // alias would match inside `**Feature image:** Alt text: "..."` and eat the
  // image brief, which is the one non-metadata line that sits in a preamble.
  { pattern: 'cover\\s*image\\s*alt(?:\\s*text)?', key: LABELS.coverImageAlt },
  { pattern: 'social\\s*share\\s*image(?:\\s*url)?', key: LABELS.ogImageUrl },
  { pattern: 'og\\s*image(?:\\s*url)?', key: LABELS.ogImageUrl },
]

/**
 * One labelled field, matched **anywhere on a line** rather than anchored to
 * the start of one, because the bold spelling runs all three onto one line and
 * the value of each ends where the next one begins.
 *
 * The pieces, in order: an optional opening `**`/`__`; the label; an optional
 * `(55 chars)` note the SEO template puts on it; an optional closing `**`/`__`
 * — before *or* after the separator, since drafts do both; and the separator
 * itself, a colon or a spaced dash. Google Docs rewrites a typed `-` as `—` on
 * paste, so all three dashes are accepted.
 *
 * Longer aliases are listed before the ones they contain (`url slug` before
 * `slug`, `meta title` before nothing) because alternation is first-match and
 * `slug` would otherwise match inside `URL Slug` and leave `URL` as a value.
 */
const LABEL_LINE = new RegExp(
  '(?:\\*\\*|__)?\\s*' +
    `(${LABEL_ALIASES.map((a) => a.pattern).join('|')})` +
    '\\s*(?:\\([^)]*\\))?\\s*' +
    '(?:\\*\\*|__)?\\s*' +
    '(?::|\\s+[-–—]\\s*|–\\s*|—\\s*)' +
    '\\s*(?:\\*\\*|__)?\\s*',
  'gi',
)

function labelKey(matched: string): LabelKey | null {
  const normalized = matched.trim().toLowerCase()
  for (const alias of LABEL_ALIASES) {
    if (new RegExp(`^${alias.pattern}$`, 'i').test(normalized)) return alias.key
  }
  return null
}

/** `---`, `***`, `___` — the fence the bold spelling closes its block with. */
const DIVIDER_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

/**
 * Anything that opens a real block. A preamble line is prose by definition, so
 * a line that opens a list, a table, a quote, a fence or a heading ends the
 * preamble no matter what labels it appears to carry.
 */
const BLOCK_OPENER = /^\s*(?:#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|>|\||```|~~~|:::|!\[)/

export interface DocFrontMatterFields {
  title: string
  slug: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  targetKeyword: string
  canonicalUrl: string
  coverImageAlt: string
  ogImageUrl: string
}

export interface DocImport {
  /** The markdown with the preamble and the duplicate title removed. */
  body: string
  /** Only the fields the document actually carried; the rest are absent. */
  fields: Partial<DocFrontMatterFields>
  /** Field labels, for the one-line note the editor shows the writer. */
  consumed: string[]
}

const EMPHASIS = /(\*\*|__|\*|_)/g

/** Strips emphasis and the escapes `lexicalToMarkdown` adds to plain text. */
function plain(value: string): string {
  return value
    .replace(EMPHASIS, '')
    .replace(/\\([\\`*_~[\]<>#|:-])/g, '$1')
    .trim()
}

/**
 * `/blog/how-to-choose-the-right-paint-finish` -> the last segment.
 *
 * The SEO team writes the slug as a path, and which path it is has nothing to
 * do with where this CMS publishes: three of the four sites serve a CMS
 * article from `/resources/<slug>` whatever the draft says. Only the final
 * segment is the slug, and it is normalised the same way the slug box
 * normalises what a writer types into it.
 */
function slugFromPath(value: string): string {
  const withoutQuery = plain(value).split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  const last = segments.length > 0 ? segments[segments.length - 1] : ''
  return last
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/(^-|-$)+/g, '')
}

/** Splits a keyword line on commas, drops blanks, keeps the writer's order. */
function keywordsFrom(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    for (const raw of plain(line).split(',')) {
      const keyword = raw.trim()
      if (!keyword) continue
      const key = keyword.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(keyword)
    }
  }
  return out
}

/** Every labelled field on one line, in the order they appear on it. */
function fieldsOnLine(line: string): { key: LabelKey; value: string }[] {
  const matches: { key: LabelKey; start: number; end: number }[] = []
  LABEL_LINE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LABEL_LINE.exec(line)) !== null) {
    const key = labelKey(match[1])
    if (key) matches.push({ key, start: match.index, end: match.index + match[0].length })
    // A zero-width match would spin forever; the pattern can match empty only
    // if both the label and the separator were optional, which they are not,
    // but the guard costs nothing next to a hung editor.
    if (match.index === LABEL_LINE.lastIndex) LABEL_LINE.lastIndex += 1
  }

  return matches.map((m, i) => ({
    key: m.key,
    value: line.slice(m.end, i + 1 < matches.length ? matches[i + 1].start : line.length),
  }))
}

/**
 * Reads the front-matter preamble and the duplicate title out of a pasted
 * Google Docs export.
 *
 * Returns the document unchanged, with no fields, when it does not look like
 * one of these drafts — which is the only safe default, since every change
 * this makes deletes text the writer can see.
 */
export function readDocFrontMatter(markdown: string): DocImport {
  const source = markdown.replace(/\r\n?/g, '\n')
  const lines = source.split('\n')

  /**
   * The preamble is bounded above by the article's own title, so the search
   * stops at the first heading. That is a real anchor rather than a guess:
   * metadata is written above the title by definition, and anything below it
   * is article copy that must not be touched however label-shaped it looks.
   * A heading here is whatever `markdownBlocks` calls one, which includes the
   * SEO team's `**(H2) …**` written with no `#` at all.
   */
  const headingAt = lines.findIndex(
    (line) => line.trim() !== '' && parseMarkdownBlocks(line)[0]?.type === 'heading',
  )
  if (headingAt < 0) return { body: markdown, fields: {}, consumed: [] }

  // Tag lines are the one non-metadata thing that reliably sits inside the
  // preamble — the image brief for the feature image is written above the H1.
  // They stay in the body, where the Generate button turns each into the
  // picture it describes on the line it already occupies.
  const placeholderLines = new Set(findImagePlaceholders(source).map((p) => p.line))

  const values = new Map<LabelKey, string[]>()
  const record = (key: LabelKey, value: string) => {
    const existing = values.get(key)
    if (existing) existing.push(value)
    else values.set(key, [value])
  }

  /**
   * `Keywords -` is the one label whose value is the *lines below it*. It stays
   * open until the next label or the end of the preamble, which is why the
   * walk carries state rather than reading each line on its own.
   */
  let openMultiLine: LabelKey | null = null
  let consumedUpTo = 0

  for (let i = 0; i < headingAt; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '' || DIVIDER_LINE.test(trimmed)) {
      consumedUpTo = i + 1
      continue
    }

    // Checked before the labels: a heading-shaped or list-shaped line is a
    // block, whatever words are on it.
    if (BLOCK_OPENER.test(line) || placeholderLines.has(i + 1)) break

    const fields = fieldsOnLine(line)
    if (fields.length > 0) {
      for (const field of fields) {
        const value = field.value.trim()
        if (value) record(field.key, value)
      }
      const last = fields[fields.length - 1]
      openMultiLine = last.key === LABELS.keywords && !last.value.trim() ? LABELS.keywords : null
      consumedUpTo = i + 1
      continue
    }

    if (openMultiLine) {
      record(openMultiLine, trimmed)
      consumedUpTo = i + 1
      continue
    }

    break
  }

  const fields: Partial<DocFrontMatterFields> = {}
  const consumed: string[] = []

  const metaTitle = plain((values.get(LABELS.metaTitle) || [])[0] || '')
  if (metaTitle) {
    fields.metaTitle = metaTitle
    consumed.push('meta title')
  }

  const metaDescription = plain((values.get(LABELS.metaDescription) || [])[0] || '')
  if (metaDescription) {
    fields.metaDescription = metaDescription
    consumed.push('meta description')
  }

  const keywords = keywordsFrom(values.get(LABELS.keywords) || [])
  if (keywords.length > 0) {
    fields.metaKeywords = keywords.join(', ')
    consumed.push(`${keywords.length} keyword${keywords.length === 1 ? '' : 's'}`)
  }

  // An explicit primary-keyword label wins; otherwise the first of the list is
  // the one the article targets, which is how the SEO template orders them.
  const namedTarget = plain((values.get(LABELS.targetKeyword) || [])[0] || '')
  const targetKeyword = namedTarget || keywords[0] || ''
  if (targetKeyword) {
    fields.targetKeyword = targetKeyword
    if (namedTarget) consumed.push('target keyword')
  }

  const canonicalUrl = plain((values.get(LABELS.canonicalUrl) || [])[0] || '')
  if (canonicalUrl) {
    fields.canonicalUrl = canonicalUrl
    consumed.push('canonical URL')
  }

  const coverImageAlt = plain((values.get(LABELS.coverImageAlt) || [])[0] || '')
  if (coverImageAlt) {
    fields.coverImageAlt = coverImageAlt
    consumed.push('cover image alt text')
  }

  const ogImageUrl = plain((values.get(LABELS.ogImageUrl) || [])[0] || '')
  if (ogImageUrl) {
    fields.ogImageUrl = ogImageUrl
    consumed.push('social share image')
  }

  const slug = slugFromPath((values.get(LABELS.slug) || [])[0] || '')
  if (slug) {
    fields.slug = slug
    consumed.push('URL slug')
  }

  const body = lines.slice(consumedUpTo)
  const titleFromHeading = liftLeadingTitle(body, consumedUpTo, placeholderLines)
  if (titleFromHeading) {
    fields.title = titleFromHeading
    consumed.push('article title')
  } else {
    // No `#` to lift, so the topic line is the only name the document carries.
    const topic = plain((values.get(LABELS.topic) || [])[0] || '')
    if (topic) {
      fields.title = topic
      consumed.push('article title')
    }
  }

  if (consumed.length === 0) return { body: markdown, fields: {}, consumed: [] }

  return { body: body.join('\n').replace(/^\n+/, ''), fields, consumed }
}

/**
 * Takes the document's own `# Title` out of the body and returns its text.
 *
 * The page template already prints the post title as an `<h1>`, so leaving
 * this one in the body publishes the same sentence twice, as two competing
 * `<h1>`s, on all four sites. It is not the "a body `#` is a real `<h1>`" rule
 * being undone — a `#` a writer types mid-article still renders as one. This
 * is the *document's title line*, which belongs in the title box.
 *
 * It is lifted only when it is the first heading and only blanks, images and
 * image briefs sit above it. The SEO template writes the feature-image brief
 * above the H1 even though its own note says "below H1, above intro", so the
 * brief has to be allowed to precede the title without blocking the lift —
 * and once the title is gone that brief is the first block, which is where
 * the note asked for it anyway.
 *
 * Mutates `body`, which is the caller's own array.
 */
function liftLeadingTitle(
  body: string[],
  offset: number,
  placeholderLines: Set<number>,
): string {
  for (let i = 0; i < body.length; i++) {
    const line = body[i]
    const trimmed = line.trim()

    if (trimmed === '') continue
    if (placeholderLines.has(offset + i + 1)) continue

    const block = parseMarkdownBlocks(line)[0]
    if (!block) continue
    if (block.type === 'image') continue

    if (block.type === 'heading' && block.level === 1) {
      // The blank line under it goes too, or the lift leaves a double gap that
      // the serializer would then write back into the stored markdown.
      const removed = body[i + 1] !== undefined && body[i + 1].trim() === '' ? 2 : 1
      body.splice(i, removed)
      return block.text
    }
    return ''
  }
  return ''
}

/* ------------------------------------------------------------------ *
 * The SEO block the editor keeps at the top of the body
 * ------------------------------------------------------------------ */

/**
 * The SEO fields a writer edits as text, in a labelled block above the
 * article, instead of in a panel of form boxes.
 *
 * The block is what the writer sees and types into; the columns behind it are
 * written from it on save. That is the whole reason it exists — a draft
 * arrives with these lines already in it, and asking someone to retype five
 * values into a panel that sits below 3,000 words of article is asking them to
 * make a transcription mistake.
 *
 * `title` and `slug` are deliberately **not** here. Both have their own box on
 * the form and both are visible without scrolling, so a second copy in the
 * body could only disagree with the box.
 */
export interface SeoBlockFields {
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  targetKeyword: string
  canonicalUrl: string
  coverImageAlt: string
  ogImageUrl: string
}

/** The one spelling the editor writes, and the order it writes them in. */
const SEO_BLOCK_ORDER: { key: keyof SeoBlockFields; label: string }[] = [
  { key: 'metaTitle', label: 'Meta Title' },
  { key: 'metaDescription', label: 'Meta Description' },
  { key: 'metaKeywords', label: 'Keywords' },
  { key: 'targetKeyword', label: 'Target Keyword' },
  { key: 'canonicalUrl', label: 'Canonical URL' },
  { key: 'coverImageAlt', label: 'Cover Image Alt' },
  { key: 'ogImageUrl', label: 'Social Share Image' },
]

/**
 * Which labels belong to the block. `topic` and `slug` are read by the Google
 * Docs importer into the title and slug boxes and are not part of it, so a
 * line carrying only one of them ends the block rather than being eaten.
 */
const SEO_BLOCK_KEYS: Record<LabelKey, keyof SeoBlockFields | null> = {
  topic: null,
  slug: null,
  keywords: 'metaKeywords',
  metaTitle: 'metaTitle',
  metaDescription: 'metaDescription',
  targetKeyword: 'targetKeyword',
  canonicalUrl: 'canonicalUrl',
  coverImageAlt: 'coverImageAlt',
  ogImageUrl: 'ogImageUrl',
}

export interface SeoBlockRead {
  /** The article, with the block taken off the top. */
  body: string
  /** Only the labels that carried a value. A cleared label comes back absent. */
  fields: Partial<SeoBlockFields>
  /** Whether the markdown opened with a block at all. */
  present: boolean
}

/**
 * Writes the fields back out as the block, or `''` when none are set.
 *
 * Values are flattened to one line each: the block is line-oriented, and a
 * meta description typed across two lines would otherwise reopen as a
 * description that ends at the first newline plus a stray paragraph.
 */
export function formatSeoBlock(fields: Partial<SeoBlockFields>): string {
  const lines = SEO_BLOCK_ORDER.map(({ key, label }) => {
    const value = (fields[key] || '').replace(/\s+/g, ' ').trim()
    return value ? `${label}: ${value}` : ''
  }).filter(Boolean)

  return lines.join('\n')
}

/**
 * Reads the block back off the top of the body.
 *
 * **Leading run only**, and with no heading needed above it — both differences
 * from `readDocFrontMatter`, and both deliberate. This runs on every keystroke
 * in the editor, over text the writer is in the middle of typing, so it may
 * only ever look at the top of the document: a `Meta Title:` sentence written
 * in the middle of an article is article copy and is never touched. The
 * importer can afford to scan further because it runs once, on a paste.
 *
 * A label with an empty value still belongs to the block. Clearing a meta
 * description by deleting the words after the colon has to clear the column,
 * not end the block and publish the lines below it as prose.
 */
export function readSeoBlock(markdown: string): SeoBlockRead {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const fields: Partial<SeoBlockFields> = {}

  let index = 0
  while (index < lines.length && lines[index].trim() === '') index++

  const start = index
  for (; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') break
    if (BLOCK_OPENER.test(line)) break

    let read = false
    for (const field of fieldsOnLine(line)) {
      const key = SEO_BLOCK_KEYS[field.key]
      if (!key) continue
      read = true
      const value = plain(field.value).replace(/\s+/g, ' ').trim()
      if (value && fields[key] === undefined) fields[key] = value
    }
    if (!read) break
  }

  if (index === start) return { body: markdown, fields: {}, present: false }

  // The blank line under the block separated it from the article; it is part
  // of the block, not the first thing in the body.
  let bodyAt = index
  while (bodyAt < lines.length && lines[bodyAt].trim() === '') bodyAt++

  return { body: lines.slice(bodyAt).join('\n'), fields, present: true }
}

/** The block above the article, with the blank line the two need between them. */
export function joinSeoBlock(block: string, body: string): string {
  if (!block) return body
  if (!body.trim()) return `${block}\n\n`
  return `${block}\n\n${body.replace(/^\n+/, '')}`
}
