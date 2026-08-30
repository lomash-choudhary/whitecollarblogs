/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Converts Payload's Lexical rich-text JSON into plain Markdown.
 *
 * Shared by the browser editor (round-tripping the textarea) and by the
 * server-side multi-site publisher, which ships this Markdown to other
 * websites' GitHub repos.
 */

export function renderLeafToMarkdown(leaf: any): string {
  if (!leaf || !leaf.text) return ''
  let text = leaf.text
  const format = leaf.format || 0
  const isBold = (format & 1) !== 0
  const isItalic = (format & 2) !== 0
  const isUnderline = (format & 8) !== 0
  const isCode = (format & 16) !== 0
  
  if (isCode) text = `\`${text}\``
  if (isBold) text = `**${text}**`
  if (isUnderline) text = `__${text}__`
  if (isItalic) text = `*${text}*`
  return text
}

export function serializeInlineNodes(nodes: any[]): string {
  if (!nodes) return ''
  let text = ''
  for (const node of nodes) {
    if (node.type === 'link') {
      const linkText = node.children?.map((leaf: any) => renderLeafToMarkdown(leaf)).join('') || ''
      const url = node.fields?.url || ''
      const rel = node.fields?.rel || []
      const isNofollow = Array.isArray(rel) ? rel.includes('nofollow') : rel === 'nofollow'
      text += `[${linkText}](${url}${isNofollow ? ' "nofollow"' : ''})`
    } else if (node.type === 'image') {
      text += `![${node.alt || 'image'}](${node.url})`
    } else if (node.type === 'video') {
      text += `![video](${node.url})`
    } else {
      text += renderLeafToMarkdown(node)
    }
  }
  return text
}

export function lexicalToMarkdown(lexical: any): string {
  if (!lexical) return ''
  if (typeof lexical === 'string') return lexical
  try {
    const children = lexical.root?.children || []
    let md = ''
    for (const node of children) {
      if (!node) continue
      
      if (node.type === 'paragraph') {
        const pText = serializeInlineNodes(node.children)
        md += pText + '\n\n'
      } else if (node.type === 'heading') {
        let level = 3
        if (node.tag === 'h1') level = 1
        if (node.tag === 'h2') level = 2
        const hText = '#'.repeat(level) + ' ' + serializeInlineNodes(node.children)
        md += hText + '\n\n'
      } else if (node.type === 'quote') {
        const qText = '> ' + serializeInlineNodes(node.children)
        md += qText + '\n\n'
      } else if (node.type === 'list') {
        const isNumbered = node.listType === 'number'
        if (node.children) {
          node.children.forEach((item: any, i: number) => {
            if (item.type === 'listitem' && item.children) {
              let itemText = isNumbered ? `${i + 1}. ` : '- '
              itemText += serializeInlineNodes(item.children)
              md += itemText + '\n'
            }
          })
        }
        md += '\n'
      } else if (node.type === 'table') {
        const rows = node.children || []
        rows.forEach((row: any, rowIndex: number) => {
          if (row.type === 'tablerow') {
            const cells = row.children || []
            let rowText = '|'
            cells.forEach((cell: any) => {
              if (cell.type === 'tablecell') {
                const cellText = cell.children?.map((leaf: any) => renderLeafToMarkdown(leaf)).join('') || ''
                rowText += ` ${cellText} |`
              }
            })
            md += rowText + '\n'
            if (rowIndex === 0) {
              let sepText = '|'
              cells.forEach(() => {
                sepText += '---|'
              })
              md += sepText + '\n'
            }
          }
        })
        md += '\n'
      }
    }
    return md.trim()
  } catch {
    return ''
  }
}
