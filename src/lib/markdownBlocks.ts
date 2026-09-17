/**
 * Canonical markdown -> block AST.
 *
 * SYNCED FILE. Byte-identical copies live in every repo that renders a post
 * written in the CMS:
 *
 *   whitecollarblogs   src/lib/markdownBlocks.ts   (this file, the original)
 *   ovopainting        src/lib/markdownBlocks.ts
 *   durohomes          src/lib/markdownBlocks.ts
 *   rangerwebsite      src/lib/markdownBlocks.ts
 *
 * It is the single definition of *what markdown means* across all four sites.
 * A feature added here and rendered by each site's template is a feature every
 * site has; that is the whole point. Change it in one repo and you have
 * reintroduced the drift this file exists to remove — copy it to all four.
 *
 * Deliberately dependency-free (no remark, no gray-matter): the four repos do
 * not share a package, and a parser with no imports can be copied verbatim
 * instead of being kept in version lockstep across four package.json files.
 *
 * It returns an ORDERED list of blocks rather than a record of named slots
 * (`section.table`, `section.list`). Slots silently drop the second table in a
 * section and reorder a list that was written after one; a list preserves what
 * the writer actually typed.
 */

/* ─────────────────────────────── Inline ─────────────────────────────────── */

export interface InlineText {
  type: 'text'
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
}

export interface InlineLink {
  type: 'link'
  url: string
  /** Rendered as rel="nofollow"; written as [text](url "nofollow"). */
  nofollow?: boolean
  newTab?: boolean
  children: InlineText[]
}

/** A hard line break: a line ended with two spaces or a backslash. */
export interface InlineBreak {
  type: 'break'
}

export type Inline = InlineText | InlineLink | InlineBreak

/* ─────────────────────────────── Blocks ─────────────────────────────────── */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type ColumnAlign = 'left' | 'center' | 'right'
export type CalloutVariant = 'note' | 'tip' | 'warning' | 'key'

export interface HeadingBlock {
  type: 'heading'
  level: HeadingLevel
  /** Emphasis stripped, for a table of contents. */
  text: string
  /** Slug of `text`, used as the anchor id. Unique within one document. */
  id: string
  children: Inline[]
}

export interface ParagraphBlock {
  type: 'paragraph'
  children: Inline[]
}

export interface ListItem {
  children: Inline[]
  /**
   * Nested list from a deeper indent under this item. A whole ListBlock, not
   * bare items, because a bullet may nest an ordered list under it and the
   * child's own marker type has to survive.
   */
  list?: ListBlock
}

export interface ListBlock {
  type: 'list'
  ordered: boolean
  /** First number of an ordered list, so "3." starts at three. */
  start: number
  items: ListItem[]
}

export interface QuoteBlock {
  type: 'quote'
  /** A blockquote can hold any block, including a list or a nested quote. */
  blocks: Block[]
}

export interface CodeBlock {
  type: 'code'
  language: string
  code: string
}

export interface DividerBlock {
  type: 'divider'
}

export interface TableBlock {
  type: 'table'
  headers: Inline[][]
  rows: Inline[][][]
  align: ColumnAlign[]
}

export interface ImageBlock {
  type: 'image'
  url: string
  alt: string
  caption: string
}

export interface VideoBlock {
  type: 'video'
  url: string
  alt: string
  caption: string
}

/** A third-party player, from a bare YouTube or Vimeo URL on its own line. */
export interface EmbedBlock {
  type: 'embed'
  provider: 'youtube' | 'vimeo'
  id: string
  url: string
  title: string
}

export interface CalloutBlock {
  type: 'callout'
  variant: CalloutVariant
  title: string
  blocks: Block[]
}

export interface TakeawaysBlock {
  type: 'takeaways'
  title: string
  /** Paragraphs written above the bullets, kept inside the box. */
  intro: Inline[][]
  items: Inline[][]
}

export interface FaqBlock {
  type: 'faq'
  title: string
  items: { question: string; answer: Block[] }[]
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | DividerBlock
  | TableBlock
  | ImageBlock
  | VideoBlock
  | EmbedBlock
  | CalloutBlock
  | TakeawaysBlock
  | FaqBlock

/* ───────────────────────────── Inline parser ────────────────────────────── */

function pushText(nodes: Inline[], text: string, marks: Partial<InlineText>): void {
  if (!text) return
  nodes.push({ type: 'text', text, ...marks })
}

/**
 * Parses one line of inline markdown.
 *
 * Order matters: inline code wins over everything (its contents are literal),
 * then the image syntax before links because `![` starts with `[`, then the
 * longest emphasis delimiter first so `***x***` is not read as `**` followed
 * by a stray `*`. `__` is UNDERLINE here, not bold — that is the convention
 * the CMS editor and its serializer have always used, and changing it would
 * silently reformat every article already published.
 */
export function parseInline(
  input: string,
  marks: Partial<InlineText> = {},
  /** Suppresses bare-URL linking inside a link label, so links cannot nest. */
  inLink = false,
): Inline[] {
  const nodes: Inline[] = []
  const text = input || ''
  let plain = ''
  let i = 0

  const flush = () => {
    pushText(nodes, plain, marks)
    plain = ''
  }

  while (i < text.length) {
    const char = text[i]

    // A newline reaching this far is a hard break the block parser kept.
    if (char === '\n') {
      flush()
      nodes.push({ type: 'break' })
      i++
      continue
    }

    // Backslash escape: the next character is literal, never a delimiter.
    if (char === '\\' && i + 1 < text.length) {
      plain += text[i + 1]
      i += 2
      continue
    }

    // <https://example.com> — an explicit autolink.
    if (char === '<' && !inLink) {
      const close = text.indexOf('>', i + 1)
      const inner = close === -1 ? '' : text.slice(i + 1, close)
      if (close !== -1 && /^(https?:\/\/|mailto:)\S+$/i.test(inner)) {
        flush()
        nodes.push({
          type: 'link',
          url: inner,
          newTab: /^https?:/i.test(inner) || undefined,
          children: [{ type: 'text', text: inner.replace(/^mailto:/i, '') }],
        })
        i = close + 1
        continue
      }
    }

    // A bare URL typed into prose. Writers paste these constantly, and left
    // as plain text they are dead on a site whose whole job is linking.
    if (!inLink && (char === 'h' || char === 'w') && BARE_URL.test(text.slice(i))) {
      const match = text.slice(i).match(BARE_URL)
      if (match) {
        const raw = trimUrlPunctuation(match[0])
        if (raw.length > 8) {
          flush()
          nodes.push({
            type: 'link',
            url: raw.startsWith('www.') ? `https://${raw}` : raw,
            newTab: true,
            children: [{ type: 'text', text: raw }],
          })
          i += raw.length
          continue
        }
      }
    }

    // Inline code — contents are not parsed any further.
    if (char === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        flush()
        pushText(nodes, text.slice(i + 1, end), { ...marks, code: true })
        i = end + 1
        continue
      }
    }

    // An image is a block, never a run of text. `![alt](url)` on its own line
    // is a figure; the same syntax inside a sentence is consumed and dropped.
    // It is still matched here rather than ignored, because falling through
    // would leave the `[alt](url)` half to the link case below and render a
    // stray `!` in front of a link nobody wrote. The run is deliberately NOT
    // flushed: the text on either side has to stay one node, or a save would
    // rewrite the sentence into two runs and the round-trip would stop being
    // a fixed point.
    if (char === '!' && text[i + 1] === '[') {
      const parsed = parseBracketLink(text, i + 1)
      if (parsed) {
        i = parsed.end
        continue
      }
    }

    // Link: [text](url) or [text](url "nofollow")
    if (char === '[') {
      const parsed = parseBracketLink(text, i)
      if (parsed) {
        flush()
        const children = parseInline(parsed.label, marks, true).filter(
          (n): n is InlineText => n.type === 'text',
        )
        nodes.push({
          type: 'link',
          url: parsed.url,
          nofollow: parsed.title.toLowerCase() === 'nofollow' || undefined,
          newTab: /^https?:\/\//i.test(parsed.url) || undefined,
          children: children.length ? children : [{ type: 'text', text: parsed.label }],
        })
        i = parsed.end
        continue
      }
    }

    // Emphasis, longest delimiter first.
    const emphasis =
      matchDelimiter(text, i, '***', { bold: true, italic: true }) ||
      matchDelimiter(text, i, '___', { underline: true, italic: true }) ||
      matchDelimiter(text, i, '~~', { strike: true }) ||
      matchDelimiter(text, i, '**', { bold: true }) ||
      matchDelimiter(text, i, '__', { underline: true }) ||
      matchDelimiter(text, i, '*', { italic: true }) ||
      matchDelimiter(text, i, '_', { italic: true })

    if (emphasis) {
      flush()
      nodes.push(...parseInline(emphasis.inner, { ...marks, ...emphasis.marks }, inLink))
      i = emphasis.end
      continue
    }

    plain += char
    i++
  }

  flush()
  return nodes
}

const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/

/**
 * Drops sentence punctuation that followed a bare URL rather than belonging to
 * it. A closing paren is kept when the URL opened one, so a Wikipedia link
 * ending in `(disambiguation)` survives.
 */
function trimUrlPunctuation(url: string): string {
  const trailing = url.match(TRAILING_PUNCTUATION)
  if (!trailing) return url

  const opened = (url.match(/\(/g) || []).length
  const closed = (url.match(/\)/g) || []).length
  if (trailing[0] === ')' && opened > closed - 1) return url

  return url.slice(0, url.length - trailing[0].length)
}

/** Reads `[label](url)` / `[label](url "title")` starting at the `[`. */
function parseBracketLink(
  text: string,
  start: number,
): { label: string; url: string; title: string; end: number } | null {
  if (text[start] !== '[') return null

  // Walk to the matching `]`, allowing one level of nesting inside the label.
  let depth = 0
  let close = -1
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1 || text[close + 1] !== '(') return null

  const paren = text.indexOf(')', close + 2)
  if (paren === -1) return null

  const label = text.slice(start + 1, close)
  const target = text.slice(close + 2, paren).trim()

  // `url "title"` — the title is how nofollow is carried through markdown.
  const titled = target.match(/^(\S+)\s+["'](.*)["']$/)
  return {
    label,
    url: titled ? titled[1] : target,
    title: titled ? titled[2].trim() : '',
    end: paren + 1,
  }
}

/** Reads a paired emphasis run such as `**bold**` starting at `start`. */
function matchDelimiter(
  text: string,
  start: number,
  delimiter: string,
  marks: Partial<InlineText>,
): { inner: string; marks: Partial<InlineText>; end: number } | null {
  if (!text.startsWith(delimiter, start)) return null
  const from = start + delimiter.length
  // An empty run (`**` immediately closed) is literal text, not emphasis.
  if (text[from] === undefined || /\s/.test(text[from])) return null

  const close = text.indexOf(delimiter, from)
  if (close === -1 || close === from) return null

  return { inner: text.slice(from, close), marks, end: close + delimiter.length }
}

/** Inline nodes flattened to plain text — for headings, TOCs and excerpts. */
export function inlineToPlainText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text
      if (node.type === 'link') return inlineToPlainText(node.children)
      return ' '
    })
    .join('')
}

/* ───────────────────────────── Block parser ─────────────────────────────── */

const FENCE = /^(```|~~~)\s*([A-Za-z0-9+#._-]*)\s*$/
const DIRECTIVE_OPEN = /^:::\s*(note|tip|warning|key|takeaways|info|caution)\s*(.*)$/i
const DIRECTIVE_CLOSE = /^:::\s*$/
/** Every keyword `DIRECTIVE_OPEN` accepts, mapped to the variant it renders as. */
const CALLOUT_VARIANTS: Record<string, CalloutVariant> = {
  note: 'note',
  info: 'note',
  tip: 'tip',
  warning: 'warning',
  caution: 'warning',
  key: 'key',
  takeaways: 'key',
}
const DIVIDER = /^(?:-{3,}|\*{3,}|_{3,})$/
const HEADING = /^(#{1,6})\s+(.*)$/
/**
 * The `(H2)` level marker the SEO team writes in front of every heading.
 *
 * Their drafts are written in Google Docs against a heading outline, and each
 * heading carries its own level as visible text — `## **(H2) Key Takeaways**`.
 * It is a production instruction, not content: left in, it prints on the live
 * page, lands in the table of contents, and lands in the anchor slug
 * (`#h2-key-takeaways`). It also broke the two heading conventions outright —
 * `TAKEAWAYS_HEADING` and `FAQ_HEADING` are anchored at the start of the text,
 * so `(H2) Key Takeaways` matched neither and every draft published with no
 * takeaways box and no FAQ accordion.
 *
 * Group 1 keeps any emphasis delimiters the marker was written inside, because
 * the marker sits *within* the bold (`**(H2) Key Takeaways**`) far more often
 * than outside it; dropping them would leave an unbalanced `**` at the end of
 * the line. Group 2 is the level, for a marker that arrives with no `#`.
 *
 * `[H2]` is accepted alongside `(H2)`, with an optional backslash on either
 * bracket: `lexicalToMarkdown` escapes `[` and `]`, so a bracketed marker comes
 * back from the very first save as `\[H2\]`.
 */
const HEADING_MARKER = /^((?:\*\*|__|\*|_)*)[ \t]*\\?[([][ \t]*[Hh]([1-6])[ \t]*\\?[)\]][ \t]*/
const BULLET = /^([-*+])\s+(.*)$/
const ORDERED = /^(\d{1,9})[.)]\s+(.*)$/
const STANDALONE_IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'](.*)["'])?\)$/
const TABLE_ROW = /^\|.*\|?\s*$/
const TABLE_SEPARATOR = /^\|?[\s:|-]*-[\s:|-]*\|?$/
/** A URL typed straight into prose, not wrapped in markdown link syntax. */
const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<>"'`]+/i
const VIDEO_FILE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i
const YOUTUBE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i
const VIMEO = /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d{6,12})/i

/** A standalone media URL as its own block, or null if it is not one. */
function mediaBlock(url: string, alt: string, caption: string): Block | null {
  const youtube = url.match(YOUTUBE)
  if (youtube) {
    return { type: 'embed', provider: 'youtube', id: youtube[1], url, title: alt || caption }
  }
  const vimeo = url.match(VIMEO)
  if (vimeo) {
    return { type: 'embed', provider: 'vimeo', id: vimeo[1], url, title: alt || caption }
  }
  if (VIDEO_FILE.test(url) || alt.trim().toLowerCase() === 'video') {
    return { type: 'video', url, alt, caption }
  }
  return null
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Strips emphasis so a heading reads cleanly in a table of contents. */
function plainHeading(text: string): string {
  return inlineToPlainText(parseInline(text)).trim()
}

/** Drops a leading `(H2)` level marker, keeping the emphasis it was inside. */
function stripHeadingMarker(text: string): string {
  return text.replace(HEADING_MARKER, '$1')
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

function columnAlign(cell: string): ColumnAlign {
  const trimmed = cell.trim()
  const left = trimmed.startsWith(':')
  const right = trimmed.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
}

interface Cursor {
  lines: string[]
  i: number
}

/**
 * Markdown -> ordered blocks.
 *
 * Front matter is NOT handled here; each site strips it before calling this,
 * because only the site knows which keys its template needs.
 */
export function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').replace(/\t/g, '  ').split('\n')
  const blocks = parseBlockRange({ lines, i: 0 })
  return foldSpecialSections(assignHeadingIds(blocks))
}

function parseBlockRange(cursor: Cursor, stopAtDirectiveClose = false): Block[] {
  const blocks: Block[] = []

  while (cursor.i < cursor.lines.length) {
    const raw = cursor.lines[cursor.i]
    const line = raw.trim()

    if (stopAtDirectiveClose && DIRECTIVE_CLOSE.test(line)) break

    if (!line) {
      cursor.i++
      continue
    }

    // Fenced code — taken before anything else so its contents stay literal.
    const fence = line.match(FENCE)
    if (fence) {
      cursor.i++
      const marker = fence[1]
      const code: string[] = []
      while (cursor.i < cursor.lines.length) {
        const current = cursor.lines[cursor.i]
        if (current.trim().startsWith(marker)) {
          cursor.i++
          break
        }
        code.push(current)
        cursor.i++
      }
      blocks.push({ type: 'code', language: fence[2] || '', code: code.join('\n') })
      continue
    }

    // ::: callout
    const directive = line.match(DIRECTIVE_OPEN)
    if (directive) {
      cursor.i++
      const inner = parseBlockRange(cursor, true)
      if (cursor.i < cursor.lines.length) cursor.i++ // consume the closing :::
      const variant = CALLOUT_VARIANTS[directive[1].toLowerCase()] || 'note'
      blocks.push({ type: 'callout', variant, title: directive[2].trim(), blocks: inner })
      continue
    }

    // Divider — before lists, so `---` is never read as a bullet.
    if (DIVIDER.test(line)) {
      blocks.push({ type: 'divider' })
      cursor.i++
      continue
    }

    // Heading
    const heading = line.match(HEADING)
    if (heading) {
      const text = stripHeadingMarker(heading[2].replace(/\s+#+\s*$/, ''))
      cursor.i++
      if (!text.trim()) continue
      blocks.push({
        type: 'heading',
        level: heading[1].length as HeadingLevel,
        text: plainHeading(text),
        id: '',
        children: parseInline(text),
      })
      continue
    }

    // A heading that lost its `#` on the way out of the writer's document but
    // kept its `(H2)` marker. Checked *after* `HEADING`, so when both are
    // present the hashes win and the marker is only stripped — a marker that
    // set the level would silently restructure an article whose two halves
    // disagree, which is the one thing worse than a visible marker.
    const markerOnly = line.match(HEADING_MARKER)
    if (markerOnly) {
      const text = stripHeadingMarker(line)
      const plain = plainHeading(text)
      if (plain) {
        cursor.i++
        blocks.push({
          type: 'heading',
          level: Number(markerOnly[2]) as HeadingLevel,
          text: plain,
          id: '',
          children: parseInline(text),
        })
        continue
      }
    }

    // Table: a pipe row, optionally followed by an alignment row.
    if (TABLE_ROW.test(line) && line.includes('|')) {
      const table = parseTable(cursor)
      if (table) {
        blocks.push(table)
        continue
      }
    }

    // Blockquote: consecutive `>` lines, re-parsed as blocks.
    if (line.startsWith('>')) {
      const quoted: string[] = []
      while (cursor.i < cursor.lines.length) {
        const current = cursor.lines[cursor.i].trim()
        if (!current.startsWith('>')) {
          // A blank line ends the quote; a plain line is a lazy continuation.
          if (!current) break
          if (isBlockStart(current)) break
          quoted.push(current)
          cursor.i++
          continue
        }
        quoted.push(current.replace(/^>\s?/, ''))
        cursor.i++
      }
      blocks.push({ type: 'quote', blocks: parseBlockRange({ lines: quoted, i: 0 }) })
      continue
    }

    // Standalone image on its own line becomes a figure, not a paragraph.
    const image = line.match(STANDALONE_IMAGE)
    if (image) {
      const url = image[2]
      const alt = image[1] || ''
      const caption = (image[3] || '').trim()
      blocks.push(mediaBlock(url, alt, caption) || { type: 'image', url, alt, caption })
      cursor.i++
      continue
    }

    // A bare YouTube or Vimeo URL alone on a line becomes a player, the way it
    // does in every editor a writer is likely to have used before.
    if (BARE_URL.test(line) && !/\s/.test(line)) {
      const embed = mediaBlock(line, '', '')
      if (embed) {
        blocks.push(embed)
        cursor.i++
        continue
      }
    }

    // Lists
    if (BULLET.test(line) || ORDERED.test(line)) {
      blocks.push(parseList(cursor))
      continue
    }

    // Paragraph, with lazy continuation across soft-wrapped lines.
    //
    // A line ending in two spaces or a backslash is a HARD break and keeps its
    // own line; anything else is a soft wrap and joins with a space. Without
    // this an address or an opening-hours block collapses into one run-on line.
    let paragraph = stripBreakMarker(line) + hardBreak(raw)
    cursor.i++
    while (cursor.i < cursor.lines.length) {
      const rawNext = cursor.lines[cursor.i]
      const next = rawNext.trim()
      if (!next || isBlockStart(next)) break
      const separator = paragraph.endsWith('\n') ? '' : ' '
      paragraph += separator + stripBreakMarker(next) + hardBreak(rawNext)
      cursor.i++
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph) })
  }

  return blocks
}

/**
 * '\n' when the raw line ended in a hard break, '' otherwise.
 *
 * Both spellings are accepted because plenty of editors strip trailing
 * whitespace on save, which would silently delete a two-space break.
 */
function hardBreak(raw: string): string {
  return /(\s\s|\\)$/.test(raw.replace(/\r?\n$/, '')) ? '\n' : ''
}

/** Removes a trailing backslash break marker from the visible text. */
function stripBreakMarker(line: string): string {
  return line.replace(/\\$/, '')
}

/** Whether a line opens a new block, so a paragraph must stop before it. */
function isBlockStart(line: string): boolean {
  return (
    HEADING.test(line) ||
    HEADING_MARKER.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    DIVIDER.test(line) ||
    FENCE.test(line) ||
    DIRECTIVE_OPEN.test(line) ||
    DIRECTIVE_CLOSE.test(line) ||
    STANDALONE_IMAGE.test(line) ||
    line.startsWith('>') ||
    line.startsWith('|')
  )
}

function parseTable(cursor: Cursor): TableBlock | null {
  const start = cursor.i
  const rows: string[][] = []
  let align: ColumnAlign[] = []
  let sawSeparator = false

  while (cursor.i < cursor.lines.length) {
    const line = cursor.lines[cursor.i].trim()
    if (!line.startsWith('|')) break

    // A separator-shaped row is a rule wherever it appears, not data.
    //
    // Markdown has exactly one, under the header, and only that one carries
    // the column alignment. But a Word table has a border under *every* row,
    // and the docx-to-markdown converters transcribe each one as another
    // `| --- | --- |` — so a five-row table arrives with five separators.
    // Read as data they rendered as a blank-looking row of literal "---"
    // between every real row, doubling the table's height.
    //
    // Dropping them is safe: a row made of nothing but dashes, colons, pipes
    // and spaces carries no content in any table, so there is nothing a writer
    // could have meant by it.
    if (TABLE_SEPARATOR.test(line)) {
      if (!sawSeparator && rows.length === 1) {
        align = splitTableRow(line).map(columnAlign)
        sawSeparator = true
      }
      cursor.i++
      continue
    }

    rows.push(splitTableRow(line))
    cursor.i++
  }

  // One pipe row with no alignment row is a paragraph that happens to
  // contain pipes, not a table.
  if (!sawSeparator || rows.length === 0) {
    cursor.i = start
    return null
  }

  const [headerRow, ...bodyRows] = rows
  const width = headerRow.length

  return {
    type: 'table',
    headers: headerRow.map((cell) => parseInline(cell)),
    rows: bodyRows
      .filter((row) => row.some((cell) => cell.length > 0))
      .map((row) => {
        const padded = row.slice(0, width)
        while (padded.length < width) padded.push('')
        return padded.map((cell) => parseInline(cell))
      }),
    align: Array.from({ length: width }, (_, i) => align[i] || 'left'),
  }
}

/** One list item line, whichever marker it uses. */
function itemMatch(line: string): { ordered: boolean; text: string; start: number } | null {
  const ordered = line.match(ORDERED)
  if (ordered) return { ordered: true, text: ordered[2], start: parseInt(ordered[1], 10) }
  const bullet = line.match(BULLET)
  if (bullet) return { ordered: false, text: bullet[2], start: 1 }
  return null
}

/**
 * Consumes one list, including anything nested under a deeper indent.
 *
 * A nested list is parsed on its own terms and stored whole on its parent
 * item, so a bullet may nest an ordered list under it. Reading the child with
 * the parent's marker type is what used to make those children match nothing
 * and disappear.
 *
 * A change of marker type at the SAME level ends the list, so a bullet run
 * followed by a numbered run renders as two lists rather than one with a
 * confused appearance.
 *
 * An item may be soft-wrapped over several lines. The continuation joins the
 * item it sits under, exactly as a soft-wrapped paragraph joins its first line
 * — without that, a wrapped bullet ended the list, became a paragraph of its
 * own and left the bullets after it in a SECOND list. Inside `## Key
 * Takeaways` the stray paragraph was collected as the box's intro, so half a
 * sentence appeared above the bullets. Continuation text is gathered as raw
 * markdown and parsed once the whole item is known, so emphasis may span the
 * wrap.
 */
function parseList(cursor: Cursor, depth = 0): ListBlock {
  const first = itemMatch(cursor.lines[cursor.i].trim())
  const ordered = Boolean(first?.ordered)
  const start = ordered && first ? Math.max(1, first.start) : 1
  const items: ListItem[] = []
  /** Raw markdown of each item, index-aligned with `items`. */
  const texts: string[] = []

  while (cursor.i < cursor.lines.length) {
    const raw = cursor.lines[cursor.i]
    const line = raw.trim()

    if (!line) {
      // A single blank line inside a list is allowed; two end it.
      const next = cursor.lines[cursor.i + 1]
      if (next === undefined || !next.trim()) break
      if (!itemMatch(next.trim())) break
      cursor.i++
      continue
    }

    const match = itemMatch(line)
    if (!match) {
      // Lazy continuation of the item above. A line that opens a block of its
      // own (a heading, a fence, a table row) still ends the list, the same
      // test a paragraph and a blockquote use.
      //
      // Nesting is handled by recursion rather than by indentation here: the
      // deepest open list is the one still reading lines, so a wrap under a
      // nested item joins that item and not its parent.
      if (!texts.length || isBlockStart(line)) break
      const previous = texts[texts.length - 1]
      texts[texts.length - 1] =
        previous + (previous.endsWith('\n') ? '' : ' ') + stripBreakMarker(line) + hardBreak(raw)
      cursor.i++
      continue
    }

    const indent = raw.length - raw.trimStart().length
    if (indent < depth) break

    if (indent >= depth + 2) {
      const nested = parseList(cursor, indent)
      if (items.length) items[items.length - 1].list = nested
      continue
    }

    if (match.ordered !== ordered) break

    items.push({ children: [] })
    texts.push(stripBreakMarker(match.text) + hardBreak(raw))
    cursor.i++
  }

  // Parsed at the end because an item's text is only complete once its
  // continuation lines have been read.
  items.forEach((item, index) => {
    item.children = parseInline(texts[index])
  })

  return { type: 'list', ordered, start, items }
}

/* ─────────────────────── Anchors and special sections ───────────────────── */

/** Gives every heading a document-unique anchor id. */
function assignHeadingIds(blocks: Block[]): Block[] {
  const used = new Set<string>()
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === 'heading') {
        const base = slugifyHeading(block.text) || 'section'
        let id = base
        let n = 2
        while (used.has(id)) id = `${base}-${n++}`
        used.add(id)
        block.id = id
      } else if (block.type === 'quote' || block.type === 'callout') {
        walk(block.blocks)
      }
    }
  }
  walk(blocks)
  return blocks
}

const TAKEAWAYS_HEADING = /^key\s*takeaways?\b/i
const FAQ_HEADING = /^(faqs?|frequently\s+asked\s+questions)\b/i

/** A ":" or dash between a bold question and its answer on the same line. */
const FAQ_ANSWER_SEPARATOR = /^[ \t]*[:—–-][ \t]*/

/**
 * A FAQ question written as a **bold paragraph** rather than an `###` heading.
 *
 * This is how the SEO team actually writes a FAQ — the question is a bold
 * paragraph and the answer is the paragraph under it, or the same paragraph
 * after a colon. Read with the `###` rule alone it produced **zero** items, so
 * `foldSpecialSections` fell through to its "leave the section as written"
 * branch and every FAQ on every site rendered as loose prose. That fallback is
 * correct and silent, which is why nobody caught it from the CMS side.
 *
 * Only called on blocks *inside* a FAQ section, so an ordinary bold lead-in
 * elsewhere in the article is never at risk. Inside one it still has to be
 * distinguished from a lead-in, and three shapes are accepted:
 *
 *   **Question?**                  the bold run is the whole paragraph
 *   **Question?** Answer prose.    the bold run ends in a question mark
 *   **Label**: answer prose.       a ":" or dash separates the two
 *
 * Anything else — a bold run that merely opens a sentence, the way "**Kitchen
 * wall paint finish** needs to handle grease" does — stays a paragraph.
 *
 * `lenient` drops those three tests and takes any leading bold run. It is only
 * ever used for a **second pass** over a section the strict pass found nothing
 * in, where the choice is not between a right and a wrong split but between a
 * rough accordion and no accordion at all. The shape it rescues is a question
 * with no blank line under it: CommonMark folds the answer onto the question's
 * own paragraph as a soft wrap, and nothing survives into the AST to say the
 * two were written on separate lines.
 */
function faqQuestionFromParagraph(
  block: Block,
  lenient = false,
): { question: string; answer: ParagraphBlock | null } | null {
  if (block.type !== 'paragraph') return null

  const opener = block.children[0]
  if (!opener || opener.type !== 'text' || !opener.bold || opener.code) return null
  // A trailing colon belongs to the syntax, not to the question.
  const question = opener.text.trim().replace(/[:\s]+$/, '')
  if (!question) return null

  let tail = block.children.slice(1)
  while (tail.length && tail[0].type === 'break') tail = tail.slice(1)

  const lead = tail[0]
  const separated = !!lead && lead.type === 'text' && FAQ_ANSWER_SEPARATOR.test(lead.text)
  if (tail.length && !separated && !/\?$/.test(question) && !lenient) return null

  if (!tail.length) return { question, answer: null }

  // The space after the bold run, and any ":" separator, are syntax rather
  // than answer. Left in, the answer serialises back out with a leading space
  // that the next parse trims — so saving twice would not be a fixed point.
  const answer: Inline[] = tail.slice(1)
  if (lead.type === 'text') {
    const text = lead.text.replace(FAQ_ANSWER_SEPARATOR, '').replace(/^\s+/, '')
    if (text) answer.unshift({ ...lead, text })
  } else {
    answer.unshift(lead)
  }
  return { question, answer: answer.length ? { type: 'paragraph', children: answer } : null }
}

/**
 * Question/answer pairs out of one FAQ section's blocks, or null when the
 * section holds none — which is the signal to try again leniently.
 *
 * Anything written between the heading and the first question used to be
 * dropped on the floor along with the heading — a silent content loss that
 * only stayed invisible because a FAQ section normally opens straight onto its
 * first question. It is kept by folding it into the **first answer**.
 *
 * That is not where it was written, but every alternative is worse. A
 * `FaqBlock` has no intro slot the way a `TakeawaysBlock` does, and adding one
 * means a case in all four renderers. Pushing it back into the flow ahead of
 * the box breaks the round-trip outright: a FAQ that follows a `## Key
 * Takeaways` section puts those blocks between the box and the next heading,
 * where the next parse reads them as the takeaways section's own intro and
 * renders them *above* the bullets — so saving twice reorders the article.
 * Inside an answer they re-parse to exactly where they were written out.
 */
function collectFaqItems(
  body: Block[],
  lenient: boolean,
): { question: string; answer: Block[] }[] | null {
  const intro: Block[] = []
  const items: { question: string; answer: Block[] }[] = []
  let current: { question: string; answer: Block[] } | null = null

  for (const child of body) {
    if (child.type === 'heading' && child.level >= 3) {
      if (current) items.push(current)
      current = { question: child.text, answer: [] }
      continue
    }
    const asked = faqQuestionFromParagraph(child, lenient)
    if (asked) {
      if (current) items.push(current)
      current = { question: asked.question, answer: asked.answer ? [asked.answer] : [] }
      continue
    }
    if (current) current.answer.push(child)
    else intro.push(child)
  }
  if (current) items.push(current)
  if (!items.length) return null

  items[0].answer.unshift(...intro)
  return items
}

/**
 * Turns two heading-led conventions into their own blocks, so every site can
 * render the styled boxes its template already has:
 *
 *   ## Key Takeaways   + bullets  -> TakeawaysBlock
 *   ## FAQ             + ### Q/A  -> FaqBlock
 *
 * Heading-driven rather than a new syntax because articles already published
 * to OVO Painting use exactly these headings — switching to a fence would
 * strip the box off every one of them.
 */
function foldSpecialSections(blocks: Block[]): Block[] {
  const out: Block[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type !== 'heading' || block.level > 2) {
      out.push(block)
      continue
    }

    const isTakeaways = TAKEAWAYS_HEADING.test(block.text)
    const isFaq = FAQ_HEADING.test(block.text)
    if (!isTakeaways && !isFaq) {
      out.push(block)
      continue
    }

    // Everything up to the next h1/h2 belongs to this section.
    const body: Block[] = []
    let j = i + 1
    while (j < blocks.length) {
      const next = blocks[j]
      if (next.type === 'heading' && next.level <= 2) break
      body.push(next)
      j++
    }

    if (isTakeaways) {
      const items: Inline[][] = []
      const intro: Inline[][] = []
      for (const child of body) {
        if (child.type === 'list') items.push(...child.items.map((item) => item.children))
        else if (child.type === 'paragraph') intro.push(child.children)
      }
      // With no bullets there is no box to build; leave the section as written.
      if (!items.length) {
        out.push(block, ...body)
      } else {
        out.push({ type: 'takeaways', title: block.text, intro, items })
      }
      i = j - 1
      continue
    }

    const faqItems = collectFaqItems(body, false) || collectFaqItems(body, true)

    if (!faqItems) {
      out.push(block, ...body)
    } else {
      out.push({ type: 'faq', title: block.text, items: faqItems })
    }
    i = j - 1
  }

  return out
}

/* ───────────────────────────────── Helpers ──────────────────────────────── */

export interface TocEntry {
  id: string
  text: string
  level: HeadingLevel
}

/** Headings for a table of contents, in document order. */
export function extractToc(blocks: Block[], maxLevel: HeadingLevel = 3): TocEntry[] {
  return blocks
    .filter((b): b is HeadingBlock => b.type === 'heading' && b.level <= maxLevel)
    .filter((b) => b.text.trim().length > 0)
    .map(({ id, text, level }) => ({ id, text, level }))
}

/** First real paragraph, for an excerpt or meta description. */
export function firstParagraphText(blocks: Block[]): string {
  const paragraph = blocks.find((b): b is ParagraphBlock => b.type === 'paragraph')
  return paragraph ? inlineToPlainText(paragraph.children).replace(/\s+/g, ' ').trim() : ''
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function inlineWordCount(nodes: Inline[]): number {
  return wordCount(inlineToPlainText(nodes))
}

/** Rough word count, used for a "N min read" estimate. */
export function countWords(blocks: Block[]): number {
  let words = 0

  const walkItems = (items: ListItem[]) => {
    for (const item of items) {
      words += inlineWordCount(item.children)
      if (item.list) walkItems(item.list.items)
    }
  }

  const walk = (list: Block[]) => {
    for (const block of list) {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
          words += inlineWordCount(block.children)
          break
        case 'list':
          walkItems(block.items)
          break
        case 'quote':
        case 'callout':
          walk(block.blocks)
          break
        case 'takeaways':
          for (const item of [...block.intro, ...block.items]) words += inlineWordCount(item)
          break
        case 'faq':
          for (const item of block.items) {
            words += wordCount(item.question)
            walk(item.answer)
          }
          break
        case 'table':
          for (const row of [block.headers, ...block.rows]) {
            for (const cell of row) words += inlineWordCount(cell)
          }
          break
        default:
          break
      }
    }
  }

  walk(blocks)
  return words
}

export function readTimeFromBlocks(blocks: Block[]): string {
  return `${Math.max(1, Math.round(countWords(blocks) / 220))} min read`
}

/* ──────────────────────── Grouping for article templates ────────────────── */

export interface ArticleSection {
  id: string
  heading: string
  level: HeadingLevel
  blocks: Block[]
}

export interface ArticleOutline {
  /** Blocks before the first heading. */
  intro: Block[]
  /**
   * The first takeaways box, if the article has one — a *reference* to a block
   * that is still sitting in `intro` or in one of `sections`, never a block
   * removed from the flow. It is here so a template can build a table-of-
   * contents entry and a schema payload without walking every section; render
   * the box from the block list, or it renders twice.
   */
  takeaways: TakeawaysBlock | null
  sections: ArticleSection[]
  /** The first FAQ, on the same terms as `takeaways` above. */
  faq: FaqBlock | null
  conclusion: ArticleSection | null
}

const CONCLUSION_HEADING =
  /^(conclusion|final thoughts?|wrapping up|the bottom line|in summary|summary)\b/i

/**
 * Regroups a flat block list under its h1/h2 headings.
 *
 * The three painting sites all render an article as a sticky table of contents
 * beside h2-delimited sections. That reshaping is identical on all three, so it
 * lives here rather than being written three slightly different ways.
 *
 * Each section keeps its blocks in the order they were written — a section with
 * two tables keeps both, and a list typed after a table still renders after it.
 * **The takeaways box and the FAQ are part of that order too.** They used to be
 * lifted out of the flow onto `outline.takeaways` / `outline.faq` and drawn by
 * the template in one fixed slot between the intro and the first section, which
 * meant an article whose first line was a `#` — a heading opens a section, `#`
 * included, so the feature image and the intro paragraph landed *inside* that
 * section — rendered its takeaways box above its own title. The box moved
 * because of a heading three lines above it. That is the named-slot failure
 * this file exists to avoid, and the CMS preview never had it: it renders the
 * block list straight through and always drew the box where it was typed.
 */
export function groupIntoSections(blocks: Block[]): ArticleOutline {
  const outline: ArticleOutline = {
    intro: [],
    takeaways: null,
    sections: [],
    faq: null,
    conclusion: null,
  }

  let current: ArticleSection | null = null

  for (const block of blocks) {
    // Noted, not removed. Recording the first of each lets a template build a
    // TOC entry and a FAQPage schema cheaply; the block itself falls through to
    // the flow below so it renders where the writer put it. A second box is
    // left in the flow as well — two `## Key Takeaways` headings are two boxes
    // on the page, the same answer the editor's preview gives.
    if (block.type === 'takeaways' && !outline.takeaways) outline.takeaways = block
    if (block.type === 'faq' && !outline.faq) outline.faq = block

    if (block.type === 'heading' && block.level <= 2) {
      const section: ArticleSection = {
        id: block.id,
        heading: block.text,
        level: block.level,
        blocks: [],
      }
      if (CONCLUSION_HEADING.test(block.text) && !outline.conclusion) outline.conclusion = section
      else outline.sections.push(section)
      current = section
      continue
    }

    if (current) current.blocks.push(block)
    else outline.intro.push(block)
  }

  return outline
}
