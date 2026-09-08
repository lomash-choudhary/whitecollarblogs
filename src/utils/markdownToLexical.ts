/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Markdown -> Payload Lexical JSON, for the blog editor's save path.
 *
 * Built on the canonical block parser (`@/lib/markdownBlocks`), which is the
 * same file the four websites use to render an article. Anything the parser
 * understands therefore survives a save here and renders identically on every
 * site — that shared parser is what keeps the four in step.
 *
 * Previously this walked the markdown itself and silently dropped whatever it
 * had no branch for: a fenced code block never reached the database, so it
 * could not be recovered by republishing. Every block type the parser returns
 * now has a case below, and `lexicalToMarkdown` reverses each one.
 */

import {
  parseMarkdownBlocks,
  type Block,
  type Inline,
  type InlineText,
} from '@/lib/markdownBlocks'

/** Lexical's text format bitmask. Matches what the public renderer reads. */
const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16

function textFormat(node: InlineText): number {
  return (
    (node.bold ? FORMAT_BOLD : 0) |
    (node.italic ? FORMAT_ITALIC : 0) |
    (node.strike ? FORMAT_STRIKETHROUGH : 0) |
    (node.underline ? FORMAT_UNDERLINE : 0) |
    (node.code ? FORMAT_CODE : 0)
  )
}

function inlineToLexical(nodes: Inline[]): any[] {
  const out = nodes.map((node) => {
    if (node.type === 'link') {
      return {
        type: 'link',
        version: 1,
        fields: {
          url: node.url,
          newTab: Boolean(node.newTab),
          rel: node.nofollow ? ['nofollow'] : [],
        },
        children: node.children.map((child) => ({
          type: 'text',
          version: 1,
          text: child.type === 'text' ? child.text : '',
          format: child.type === 'text' ? textFormat(child) : 0,
        })),
      }
    }

    if (node.type === 'break') return { type: 'linebreak', version: 1 }

    if (node.type === 'image') {
      // An image sitting inside a sentence stays inline; one on its own line
      // is a block and is handled by blockToLexical.
      const isVideo =
        /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(node.url) ||
        node.alt.toLowerCase().startsWith('video')
      return { type: isVideo ? 'video' : 'image', version: 1, url: node.url, alt: node.alt }
    }

    return { type: 'text', version: 1, text: node.text, format: textFormat(node) }
  })

  // Lexical rejects an element with no children, so an empty run needs one.
  return out.length ? out : [{ type: 'text', version: 1, text: '', format: 0 }]
}

function inlineRuns(runs: Inline[][]): any[][] {
  return runs.map(inlineToLexical)
}

function blockToLexical(block: Block): any {
  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        tag: `h${block.level}`,
        id: block.id,
        format: '',
        indent: 0,
        version: 1,
        children: inlineToLexical(block.children),
      }

    case 'paragraph':
      return {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: inlineToLexical(block.children),
      }

    case 'list':
      return {
        type: 'list',
        listType: block.ordered ? 'number' : 'bullet',
        start: block.start,
        format: '',
        indent: 0,
        version: 1,
        children: block.items.map((item) => ({
          type: 'listitem',
          version: 1,
          children: [
            ...inlineToLexical(item.children),
            // A nested list rides inside its parent item, the way Lexical
            // itself nests lists. It is converted whole, so a bullet may nest
            // an ordered list under it.
            ...(item.list ? [blockToLexical(item.list)] : []),
          ],
        })),
      }

    case 'quote':
      return {
        type: 'quote',
        format: '',
        indent: 0,
        version: 1,
        // `blocks` carries the real structure; `children` stays populated so a
        // renderer written before quotes could hold blocks still shows the text.
        blocks: block.blocks.map(blockToLexical),
        children: inlineToLexical(
          block.blocks.flatMap((child) =>
            child.type === 'paragraph' ? child.children : [],
          ),
        ),
      }

    case 'code':
      return {
        type: 'code',
        language: block.language || '',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'text', version: 1, text: block.code, format: 0 }],
      }

    case 'divider':
      return { type: 'horizontalrule', version: 1 }

    case 'table':
      return {
        type: 'table',
        align: block.align,
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'tablerow',
            version: 1,
            children: block.headers.map((cell) => ({
              type: 'tablecell',
              headerState: 1,
              version: 1,
              children: inlineToLexical(cell),
            })),
          },
          ...block.rows.map((row) => ({
            type: 'tablerow',
            version: 1,
            children: row.map((cell) => ({
              type: 'tablecell',
              headerState: 0,
              version: 1,
              children: inlineToLexical(cell),
            })),
          })),
        ],
      }

    case 'image':
      return {
        type: 'image',
        version: 1,
        url: block.url,
        alt: block.alt,
        caption: block.caption,
      }

    case 'video':
      return {
        type: 'video',
        version: 1,
        url: block.url,
        alt: block.alt,
        caption: block.caption,
      }

    case 'embed':
      return {
        type: block.provider === 'youtube' ? 'youtube' : 'embed',
        provider: block.provider,
        version: 1,
        videoID: block.id,
        id: block.id,
        url: block.url,
        title: block.title,
      }

    case 'callout':
      return {
        type: 'callout',
        variant: block.variant,
        title: block.title,
        version: 1,
        blocks: block.blocks.map(blockToLexical),
      }

    case 'takeaways':
      return {
        type: 'takeaways',
        title: block.title,
        version: 1,
        intro: inlineRuns(block.intro),
        items: inlineRuns(block.items),
      }

    case 'faq':
      return {
        type: 'faq',
        title: block.title,
        version: 1,
        items: block.items.map((item) => ({
          question: item.question,
          answer: item.answer.map(blockToLexical),
        })),
      }

    default:
      return null
  }
}

export function markdownToLexical(markdown: string): any {
  const blocks = markdown ? parseMarkdownBlocks(markdown) : []
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: blocks.map(blockToLexical).filter(Boolean),
    },
  }
}
