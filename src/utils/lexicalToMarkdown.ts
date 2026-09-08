/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Payload Lexical JSON -> Markdown.
 *
 * Shared by the browser editor (round-tripping the textarea) and by the
 * server-side multi-site publisher, which ships this markdown to the other
 * websites' GitHub repos. It is the exact inverse of `markdownToLexical`:
 * every node type that one writes, this one reads back, so a post can be
 * edited, saved and reopened without losing a block.
 *
 * The markdown it emits is what the four sites parse with
 * `@/lib/markdownBlocks`, so the syntax here is not free-form — it has to stay
 * inside what that parser understands.
 */

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16

export function renderLeafToMarkdown(leaf: any): string {
  if (!leaf || typeof leaf.text !== 'string' || !leaf.text) return ''
  let text = leaf.text
  const format = leaf.format || 0

  // Innermost first: `code` wraps the bare text, emphasis wraps that.
  if ((format & FORMAT_CODE) !== 0) text = `\`${text}\``
  if ((format & FORMAT_BOLD) !== 0) text = `**${text}**`
  if ((format & FORMAT_UNDERLINE) !== 0) text = `__${text}__`
  if ((format & FORMAT_STRIKETHROUGH) !== 0) text = `~~${text}~~`
  if ((format & FORMAT_ITALIC) !== 0) text = `*${text}*`
  return text
}

export function serializeInlineNodes(nodes: any[]): string {
  if (!Array.isArray(nodes)) return ''
  let text = ''
  for (const node of nodes) {
    if (!node) continue
    if (node.type === 'link') {
      const linkText = (node.children || []).map(renderLeafToMarkdown).join('')
      const url = node.fields?.url || ''
      const rel = node.fields?.rel || []
      const isNofollow = Array.isArray(rel) ? rel.includes('nofollow') : rel === 'nofollow'
      text += `[${linkText}](${url}${isNofollow ? ' "nofollow"' : ''})`
    } else if (node.type === 'image') {
      text += `![${node.alt || 'image'}](${node.url})`
    } else if (node.type === 'video') {
      text += `![${node.alt || 'video'}](${node.url})`
    } else if (node.type === 'linebreak') {
      // Two trailing spaces would be stripped by an editor that trims
      // whitespace; the backslash form always survives.
      text += '\\\n'
    } else if (node.type === 'list') {
      // A nested list inside a list item is handled by serializeBlock.
      continue
    } else {
      text += renderLeafToMarkdown(node)
    }
  }
  return text
}

/** Inline children of a node, ignoring any nested block that rides along. */
function inlineOnly(nodes: any[]): any[] {
  return (nodes || []).filter((n: any) => n && n.type !== 'list')
}

function serializeListItems(node: any, depth: number): string {
  const ordered = node.listType === 'number'
  const start = Number.isFinite(node.start) ? Number(node.start) : 1
  const pad = '  '.repeat(depth)
  let md = ''

  ;(node.children || []).forEach((item: any, index: number) => {
    if (!item || item.type !== 'listitem') return
    const marker = ordered ? `${start + index}. ` : '- '
    md += `${pad}${marker}${serializeInlineNodes(inlineOnly(item.children))}\n`

    // Nested list, written two spaces further in so the parser reads it back
    // as a child of this item. Serialized on its own terms, so a bullet that
    // nests an ordered list keeps the child's numbering.
    const nested = (item.children || []).find((c: any) => c?.type === 'list')
    if (nested) md += serializeListItems(nested, depth + 1)
  })

  return md
}

function serializeBlock(node: any, depth = 0): string {
  if (!node) return ''

  switch (node.type) {
    case 'paragraph':
      return `${serializeInlineNodes(node.children)}\n\n`

    case 'heading': {
      const level = Math.min(6, Math.max(1, parseInt(String(node.tag || 'h3').slice(1), 10) || 3))
      return `${'#'.repeat(level)} ${serializeInlineNodes(node.children)}\n\n`
    }

    case 'quote': {
      // Prefer the structured blocks; fall back to the flat inline children
      // stored by older documents.
      const inner = Array.isArray(node.blocks) && node.blocks.length
        ? node.blocks.map((b: any) => serializeBlock(b, depth)).join('')
        : `${serializeInlineNodes(node.children)}\n`
      return (
        inner
          .trimEnd()
          .split('\n')
          .map((line: string) => (line ? `> ${line}` : '>'))
          .join('\n') + '\n\n'
      )
    }

    case 'list':
      return `${serializeListItems(node, depth)}\n`

    case 'code': {
      const code = (node.children || []).map((c: any) => c?.text || '').join('')
      // A fence must be longer than any run of backticks inside the code,
      // otherwise the block closes early and the rest leaks into the article.
      const longest = (code.match(/`+/g) || []).reduce(
        (max: number, run: string) => Math.max(max, run.length),
        0,
      )
      const fence = '`'.repeat(Math.max(3, longest + 1))
      return `${fence}${node.language || ''}\n${code}\n${fence}\n\n`
    }

    case 'horizontalrule':
    case 'horizontalRule':
      return '---\n\n'

    case 'image': {
      const caption = node.caption ? ` "${String(node.caption).replace(/"/g, '')}"` : ''
      return `![${node.alt || ''}](${node.url}${caption})\n\n`
    }

    case 'video': {
      const caption = node.caption ? ` "${String(node.caption).replace(/"/g, '')}"` : ''
      return `![${node.alt || 'video'}](${node.url}${caption})\n\n`
    }

    case 'youtube':
    case 'embed': {
      // A bare player URL on its own line, which every site turns back into an
      // embed. A markdown link would render as a link, not a player.
      if (node.url) return `${node.url}\n\n`
      const id = node.videoID || node.videoId || node.id || ''
      if (!id) return ''
      return node.provider === 'vimeo'
        ? `https://vimeo.com/${id}\n\n`
        : `https://www.youtube.com/watch?v=${id}\n\n`
    }

    case 'table': {
      const rows = (node.children || []).filter((r: any) => r?.type === 'tablerow')
      if (!rows.length) return ''
      const align: string[] = Array.isArray(node.align) ? node.align : []

      const cellsOf = (row: any) =>
        (row.children || [])
          .filter((c: any) => c?.type === 'tablecell')
          .map((c: any) => serializeInlineNodes(c.children).replace(/\|/g, '\\|'))

      const header = cellsOf(rows[0])
      const width = header.length
      const separator = Array.from({ length: width }, (_, i) => {
        const a = align[i] || 'left'
        return a === 'center' ? ':---:' : a === 'right' ? '---:' : '---'
      })

      let md = `| ${header.join(' | ')} |\n| ${separator.join(' | ')} |\n`
      for (const row of rows.slice(1)) {
        const cells = cellsOf(row)
        while (cells.length < width) cells.push('')
        md += `| ${cells.slice(0, width).join(' | ')} |\n`
      }
      return `${md}\n`
    }

    case 'callout': {
      const inner = (node.blocks || []).map((b: any) => serializeBlock(b, depth)).join('').trim()
      const title = node.title ? ` ${node.title}` : ''
      return `:::${node.variant || 'note'}${title}\n${inner}\n:::\n\n`
    }

    case 'takeaways': {
      const title = node.title || 'Key Takeaways'
      const intro = (node.intro || [])
        .map((run: any[]) => `${serializeInlineNodes(run)}\n\n`)
        .join('')
      const items = (node.items || [])
        .map((run: any[]) => `- ${serializeInlineNodes(run)}\n`)
        .join('')
      return `## ${title}\n\n${intro}${items}\n`
    }

    case 'faq': {
      const title = node.title || 'FAQ'
      const items = (node.items || [])
        .map((item: any) => {
          const answer = (item.answer || [])
            .map((b: any) => serializeBlock(b, depth))
            .join('')
          return `### ${item.question}\n\n${answer}`
        })
        .join('')
      return `## ${title}\n\n${items}`
    }

    default:
      return ''
  }
}

export function lexicalToMarkdown(lexical: any): string {
  if (!lexical) return ''
  if (typeof lexical === 'string') return lexical
  try {
    const children = lexical.root?.children || []
    return children
      .map((node: any) => serializeBlock(node))
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } catch {
    return ''
  }
}
