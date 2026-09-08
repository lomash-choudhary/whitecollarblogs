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

export interface InlineImage {
  type: 'image'
  url: string
  alt: string
}

/** A hard line break: a line ended with two spaces or a backslash. */
export interface InlineBreak {
  type: 'break'
}

export type Inline = InlineText | InlineLink | InlineImage | InlineBreak

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

const EMPTY_TEXT: InlineText = { type: 'text', text: '' }

function pushText(nodes: Inline[], text: string, marks: Partial<InlineText>): void {
  if (!text) return
  nodes.push({ type: 'text', text, ...marks })
}

/**
 * Parses one line of inline markdown.
 *
 * Order matters: inline code wins over everything (its contents are literal),
 * then images before links because `![` starts with `[`, then the longest
 * emphasis delimiter first so `***x***` is not read as `**` followed by a
 * stray `*`. `__` is UNDERLINE here, not bold — that is the convention the CMS
 * editor and its serializer have always used, and changing it would silently
 * reformat every article already published.
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
        // Trailing sentence punctuation belongs to the sentence, not the URL.
        let raw = match[0]
        const trailing = raw.match(/[.,;:!?)\]]+$/)
        if (trailing && !(trailing[0] === ')' && (raw.match(/\(/g) || []).length > (raw.match(/\)/g) || []).length - 1)) {
          raw = raw.slice(0, raw.length - trailing[0].length)
        }
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

    // Image: ![alt](url)
    if (char === '!' && text[i + 1] === '[') {
      const parsed = parseBracketLink(text, i + 1)
      if (parsed) {
        flush()
        nodes.push({ type: 'image', url: parsed.url, alt: parsed.label })
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
      if (node.type === 'break') return ' '
      return node.alt || ''
    })
    .join('')
}

/* ───────────────────────────── Block parser ─────────────────────────────── */

const FENCE = /^(```|~~~)\s*([A-Za-z0-9+#._-]*)\s*$/
const DIRECTIVE_OPEN = /^:::\s*(note|tip|warning|key|takeaways|info|caution)\s*(.*)$/i
const DIRECTIVE_CLOSE = /^:::\s*$/
const DIVIDER = /^(?:-{3,}|\*{3,}|_{3,})$/
const HEADING = /^(#{1,6})\s+(.*)$/
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
      const keyword = directive[1].toLowerCase()
      const variant: CalloutVariant =
        keyword === 'tip'
          ? 'tip'
          : keyword === 'warning' || keyword === 'caution'
            ? 'warning'
            : keyword === 'key' || keyword === 'takeaways'
              ? 'key'
              : 'note'
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
      const text = heading[2].replace(/\s+#+\s*$/, '')
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

    if (!sawSeparator && rows.length === 1 && TABLE_SEPARATOR.test(line)) {
      align = splitTableRow(line).map(columnAlign)
      sawSeparator = true
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

    const faqItems: { question: string; answer: Block[] }[] = []
    let current: { question: string; answer: Block[] } | null = null
    for (const child of body) {
      if (child.type === 'heading' && child.level >= 3) {
        if (current) faqItems.push(current)
        current = { question: child.text, answer: [] }
      } else if (current) {
        current.answer.push(child)
      }
    }
    if (current) faqItems.push(current)

    if (!faqItems.length) {
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

/** Rough word count, used for a "N min read" estimate. */
export function countWords(blocks: Block[]): number {
  let words = 0
  const walk = (list: Block[]) => {
    for (const block of list) {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
          words += inlineToPlainText(block.children).split(/\s+/).filter(Boolean).length
          break
        case 'list': {
          const walkItems = (items: ListItem[]) => {
            for (const item of items) {
              words += inlineToPlainText(item.children).split(/\s+/).filter(Boolean).length
              if (item.list) walkItems(item.list.items)
            }
          }
          walkItems(block.items)
          break
        }
        case 'quote':
        case 'callout':
          walk(block.blocks)
          break
        case 'takeaways':
          for (const item of [...block.intro, ...block.items]) {
            words += inlineToPlainText(item).split(/\s+/).filter(Boolean).length
          }
          break
        case 'faq':
          for (const item of block.items) {
            words += item.question.split(/\s+/).filter(Boolean).length
            walk(item.answer)
          }
          break
        case 'table':
          for (const row of [block.headers, ...block.rows.map((r) => r)]) {
            for (const cell of row as Inline[][]) {
              words += inlineToPlainText(cell).split(/\s+/).filter(Boolean).length
            }
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

/** Kept exported so a site can render an empty inline run without a special case. */
export const EMPTY_INLINE: InlineText = EMPTY_TEXT

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
  takeaways: TakeawaysBlock | null
  sections: ArticleSection[]
  faq: FaqBlock | null
  conclusion: ArticleSection | null
}

const CONCLUSION_HEADING =
  /^(conclusion|final thoughts?|wrapping up|the bottom line|in summary|summary)\b/i

/**
 * Regroups a flat block list under its h1/h2 headings.
 *
 * The three painting sites all render an article as a sticky table of contents
 * beside h2-delimited sections, with the takeaways box and the FAQ pulled out
 * into their own styled panels. That reshaping is identical on all three, so it
 * lives here rather than being written three slightly different ways.
 *
 * Each section keeps its blocks in the order they were written — a section with
 * two tables keeps both, and a list typed after a table still renders after it.
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
    if (block.type === 'takeaways') {
      // Keep the first one; a second is a writing mistake, not two boxes.
      if (!outline.takeaways) outline.takeaways = block
      continue
    }

    if (block.type === 'faq') {
      if (!outline.faq) outline.faq = block
      continue
    }

    if (block.type === 'heading' && block.level <= 2) {
      const section: ArticleSection = {
        id: block.id,
        heading: block.text,
        level: block.level,
        blocks: [],
      }
      if (CONCLUSION_HEADING.test(block.text) && !outline.conclusion) {
        outline.conclusion = section
        current = section
      } else {
        outline.sections.push(section)
        current = section
      }
      continue
    }

    if (current) current.blocks.push(block)
    else outline.intro.push(block)
  }

  return outline
}
