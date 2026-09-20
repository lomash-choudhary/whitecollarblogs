/**
 * Turns an uploaded `.docx` into the markdown this CMS already understands.
 *
 * **The target is Google Docs' own "Download as Markdown", not markdown in
 * general.** Every draft in `markdownfiles/` arrived that way: a writer opened
 * the SEO team's `.docx` in Google Docs, downloaded the `.md`, and pasted it
 * into the editor. Everything downstream — `docFrontMatter.ts` reading the
 * preamble, `imagePlaceholders.ts` matching an image brief, the `(H2)` marker
 * stripping in `markdownBlocks.ts` — was written against the shape that export
 * produces. A converter that emitted equivalent-but-differently-spelled
 * markdown would be correct and would still walk straight past all of it.
 *
 * So the conventions below are not style preferences. They are what
 * `docx/How to Choose the Right Paint Finish (rewrite).docx` and Google's own
 * export of that same document agree on, checked block by block:
 *
 *   - ATX headings, and a heading keeps the bold its run carried, so a Google
 *     Docs heading comes out as `## **(H2) Key Takeaways**` rather than
 *     `## (H2) Key Takeaways`. The SEO team's `(H2)` marker sits *inside* that
 *     bold, and `markdownBlocks.ts` strips it either way — but the bold has to
 *     survive, because a marked line with no `#` is read as a heading only
 *     when it is bold.
 *   - `-` for bullets, `1.` for ordered items, `---` for a horizontal rule.
 *   - `**bold**`, `*italic*`, `~~strikethrough~~`, `[text](url)` inline.
 *   - A blank line between every block.
 *   - GFM pipe tables.
 *
 * Two deliberate departures, both of which make the output *more* usable than
 * Google's without changing how any of it parses:
 *
 *   1. **One separator row per table, not one under every row.** Word draws a
 *      border under each row and Google transcribes each border as another
 *      `| --- | --- |`, so a five-row table exports with five separators. The
 *      parser already drops them (see "A separator row is a rule wherever it
 *      appears" in AGENTS.md) — they exist only to be deleted, and a writer
 *      who opens the body sees them until they are.
 *   2. **Underline survives as `__text__`.** Google's export drops underline
 *      entirely; this CMS has always meant underline by `__text__`, both in
 *      its editor and in `lexicalToMarkdown`, so keeping it costs nothing and
 *      losing it would silently reformat the writer's document.
 *   3. **A `$` is written plain, where Google writes `\\$`.** The parser
 *      unescapes it either way — checked, `\\$0` and `$0` both parse to
 *      `$0` — so the escape is invisible either way, and an unescaped dollar
 *      is one less backslash for a writer to trip over in the textarea.
 *
 * An embedded image becomes a bracketed image brief rather than a data URI.
 * `next/image` *throws* on an unconfigured host, so a data URI in a published
 * article does not render a broken picture — it 500s the whole page. The brief
 * is the shape `imagePlaceholders.ts` already resolves, so the writer presses
 * "Generate images" and gets a real upload in `media`, which is the one image
 * host every site already allows.
 */

import mammoth from 'mammoth'
import TurndownService from 'turndown'
// The GFM plugin is published as CommonJS with no types of its own.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const turndownGfm = require('turndown-plugin-gfm')

/**
 * Word runs that carry meaning markdown can express, and which mammoth drops
 * unless it is told not to.
 *
 * `u => u` and `strike => del` are the two that matter: without them a
 * writer's underline and strikethrough are silently flattened to plain text,
 * and the only evidence is in a published article nobody diffed.
 */
const STYLE_MAP = [
  'u => u',
  'strike => del',
  // Word's "Title" is the document title, which the SEO team writes as the
  // article's H1. Mammoth maps it to a paragraph by default, so the title line
  // would arrive as prose and `docFrontMatter.ts` would have no heading to
  // lift into the title box.
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
]

/** What one image in the source document becomes. */
const IMAGE_BRIEF = '[In-content image. Alt text: "%ALT%" Photo direction: replace with the image from the original document.]'

export interface DocxConversion {
  markdown: string
  /** Mammoth's own notes — unmapped styles and the like. Logged, never shown. */
  warnings: string[]
  /** How many embedded images became briefs, so the writer can be told. */
  imageBriefs: number
}

/**
 * Builds the Turndown instance.
 *
 * A fresh one per call: Turndown keeps rule state, and these run inside a
 * request handler where two conversions can overlap.
 */
function buildTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  })

  // Strikethrough only. The plugin's `tables` is deliberately **not** used —
  // see `tableToPipes` below for why it cannot read a Word table. Task lists
  // are not used either: the parser does not support `- [ ]` (AGENTS.md,
  // "Deliberately not supported"), so emitting one would publish a literal
  // checkbox.
  service.use([turndownGfm.strikethrough])

  /**
   * Underline, but never a link's underline.
   *
   * Word underlines every hyperlink as part of its character style, so the
   * `<u>` mammoth emits inside an `<a>` is presentation, not intent. Treated
   * as underline it produced `[__Ranger Painting__](https://…)` on the first
   * run, where Google's export of the same document says
   * `[Ranger Painting](https://…)` — a link that reads as underlined text on
   * every site because the underline is now in the *label*.
   *
   * `__` is this CMS's underline in both directions: the editor writes it and
   * `markdownBlocks.ts` reads it.
   */
  service.addRule('underline', {
    filter: (node) => node.nodeName === 'U' && !hasAncestor(node, 'A'),
    replacement: (content) => (content.trim() ? `__${content}__` : content),
  })

  /**
   * A heading has to come out on one line.
   *
   * Word wraps a long heading with soft breaks, and Turndown's default heading
   * rule keeps them — which splits `## **(H2) How to Choose the Right Interior
   * Paint Finish**` across two lines and leaves the second half as a paragraph
   * with a stray `**`. Every heading convention in this repo is anchored at the
   * start of a line, so a heading broken in half matches none of them.
   */
  service.addRule('singleLineHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, node) => {
      const level = Number((node as HTMLElement).nodeName.charAt(1))
      const text = content.replace(/\s*\n+\s*/g, ' ').trim()
      return text ? `\n\n${'#'.repeat(level)} ${text}\n\n` : ''
    },
  })

  /**
   * `- item`, with a two-space hanging indent.
   *
   * Turndown's own list rule writes the marker then *three* spaces (`-   item`)
   * and indents a continuation by four. Google writes `- item`. The difference
   * is not cosmetic here: four leading spaces is an indented code block in
   * CommonMark, and this parser resolves nesting by recursion from the marker,
   * so an over-indented continuation line lands under the wrong bullet.
   */
  service.addRule('listItem', {
    filter: 'li',
    replacement: (content, node, options) => {
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, '\n  ')
      const parent = node.parentNode as HTMLElement
      let marker = `${options.bulletListMarker} `
      if (parent?.nodeName === 'OL') {
        // An ordered list keeps the number Word gave it: a list written
        // `3. 4. 5.` under a bullet renumbers itself from one otherwise.
        const start = Number(parent.getAttribute('start') || 1)
        const index = Array.prototype.indexOf.call(parent.children, node)
        marker = `${start + index}. `
      }
      const trailing = node.nextSibling && !/\n$/.test(body) ? '\n' : ''
      return marker + body + trailing
    },
  })

  /**
   * An embedded image becomes a brief, never a data URI. See the module note:
   * a data URI is an unconfigured host and `next/image` throws on one, so the
   * article page 500s rather than showing a broken image.
   */
  service.addRule('imageToBrief', {
    filter: 'img',
    replacement: (_content, node) => {
      const alt = (node as HTMLElement).getAttribute('alt')?.trim() || 'describe this image'
      return `\n\n${IMAGE_BRIEF.replace('%ALT%', alt)}\n\n`
    },
  })

  /**
   * The whole table in one rule, rather than the GFM plugin's per-cell rules.
   *
   * Two things make that plugin unusable on mammoth's output, and both of them
   * fail *silently* — the first run of this importer turned one comparison
   * table into six tables and 54 extra paragraphs:
   *
   *   1. It only converts a table whose first row is all `<th>`. A Word table
   *      has no header cells at all, so the plugin's `keep` rule fires instead
   *      and the raw `<table>` HTML is passed straight through into the
   *      markdown, where it parses as junk. Google treats the first row as the
   *      header, which is what a Word table means, so that is what this does.
   *   2. A cell holds block elements. Mammoth wraps every cell's text in `<p>`,
   *      so the plugin's cell output carries blank lines and the row breaks
   *      apart mid-table.
   *
   * Columns are padded to an even width, as Google's export does. The parser
   * does not care, but the writer reads this in a textarea.
   */
  service.addRule('wordTable', {
    filter: 'table',
    replacement: (_content, node) => tableToPipes(service, node as HTMLTableElement),
  })

  return service
}

/** Is `node` inside a `<tag>`? Used to tell a link's underline from a writer's. */
function hasAncestor(node: Node, tag: string): boolean {
  let current: Node | null = node.parentNode
  while (current) {
    if (current.nodeName === tag) return true
    current = current.parentNode
  }
  return false
}

/**
 * One `<table>` -> one GFM pipe table.
 *
 * Cell content is converted with the same service and then flattened: a table
 * cell is one line by definition in GFM, so a `<br>` or a second paragraph
 * inside one becomes a space rather than a broken row. A literal `|` is
 * escaped, or it would end the cell early.
 */
function tableToPipes(service: TurndownService, table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const grid = rows.map((row) =>
    Array.from(row.querySelectorAll('th, td')).map((cellNode) =>
      service
        .turndown((cellNode as HTMLElement).innerHTML || '')
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\|/g, '\\|')
        .trim(),
    ),
  )

  const columns = Math.max(...grid.map((row) => row.length))
  const widths: number[] = []
  for (let c = 0; c < columns; c++) {
    widths[c] = Math.max(3, ...grid.map((row) => (row[c] || '').length))
  }

  const line = (cells: string[]) =>
    `| ${Array.from({ length: columns }, (_, c) => (cells[c] || '').padEnd(widths[c])).join(' | ')} |`

  const separator = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`

  // The first row is the header. A Word table marks no cell as a header, and
  // Google's export reads row one as the header for exactly that reason; the
  // alternative is a table with no header at all, which GFM cannot express.
  return `\n\n${[line(grid[0]), separator, ...grid.slice(1).map(line)].join('\n')}\n\n`
}

/**
 * Collapses the blank lines Turndown leaves behind and trims trailing spaces
 * off lines that are not a hard break.
 *
 * Google's export never has more than one blank line between blocks, and the
 * editor's own round-trip (`markdownToLexical` -> `lexicalToMarkdown`) is only
 * a fixed point on text that is already normalised — an imported document that
 * changes shape on its first save looks like the save corrupted it.
 *
 * **Two trailing spaces are left alone.** They are a hard break, which this
 * parser keeps even at the end of a list item, and stripping them here would
 * delete a line break the writer made in Word.
 */
function normalise(markdown: string): string {
  return (
    markdown
      .replace(/\r\n?/g, '\n')
      /**
       * Curly quotes become straight ones, because Google's export does.
       *
       * Not a guess: all six real exports in `markdownfiles/` contain zero
       * U+2019, and the `.docx` this one was made from contains two — so the
       * conversion is Google's, not the writer's. Em and en dashes are left
       * alone for the same reason, from the same evidence: those exports keep
       * them.
       *
       * It also matters downstream. `imagePlaceholders.ts` reads an alt text
       * out of `Alt text: "…"`, and while its quote-stripping does accept the
       * curly forms, every other convention in this repo — the SEO block
       * labels, the FAQ question tests — was written against what Google
       * actually emits.
       */
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      // Three or more newlines collapse to a blank line. Turndown emits runs of
      // them around block rules that already pad themselves.
      .replace(/\n{3,}/g, '\n\n')
      // A line of nothing but whitespace is a blank line, not a hard break.
      .replace(/^[ \t]+$/gm, '')
      // One trailing space is Word's, not a break; two or more are a break.
      .replace(/(\S) \n/g, '$1\n')
      .trim()
  )
}

/**
 * `.docx` bytes in, Google-Docs-shaped markdown out.
 *
 * Throws only on a file mammoth cannot open — which is the one failure worth
 * separating, because it means the upload is not a Word document at all and
 * the writer needs to be told that rather than shown an empty body.
 */
export async function docxToMarkdown(buffer: Buffer): Promise<DocxConversion> {
  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      // Keep the alt text; drop the bytes. Only `src` is returned — mammoth
      // copies the image's own `altText` onto the element afterwards
      // (`lib/images.js`), so asking for it here would either duplicate it or,
      // as the first attempt did, reach for a property its typings do not
      // declare. The brief rule above reads that `alt` and never looks at the
      // source, so an empty one is exactly right.
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    },
  )

  const markdown = normalise(buildTurndown().turndown(html))

  return {
    markdown,
    warnings: messages.map((m) => `${m.type}: ${m.message}`),
    imageBriefs: (markdown.match(/\[In-content image\. Alt text:/g) || []).length,
  }
}
