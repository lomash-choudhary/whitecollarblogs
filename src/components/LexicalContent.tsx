/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Renders a post's Lexical JSON with White Collar Advice typography.
 *
 * Every block type `markdownToLexical` can produce has a case here. That is
 * the rule this file exists to hold: the CMS must be able to *show* anything a
 * writer can type, or the editor quietly promises formatting the portal cannot
 * display. The other three websites render the same block set in their own
 * styling — see `@/lib/markdownBlocks`.
 */

import React from 'react'
import Link from 'next/link'

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'

/** Anchor id for a block that has a title but is not a heading node. */
function anchorId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/* ─────────────────────────────── Inline ─────────────────────────────────── */

/**
 * `isDark` is the surrounding panel, not a theme. Every mark that paints
 * itself navy — inline code, bold, strikethrough — is invisible inside the
 * navy takeaways box, so the box asks for the dark set instead.
 */
export function renderTextNode(node: any, index: number, isDark = false): React.ReactNode {
  if (!node) return null

  if (node.type === 'link') {
    const url = node.fields?.url || ''
    const rel = node.fields?.rel || []
    const isNofollow = Array.isArray(rel) ? rel.includes('nofollow') : rel === 'nofollow'
    const newTab = node.fields?.newTab || url.startsWith('http')

    const linkProps = {
      href: url,
      target: newTab ? '_blank' : undefined,
      rel:
        `${newTab ? 'noopener noreferrer ' : ''}${isNofollow ? 'nofollow' : ''}`.trim() ||
        undefined,
      className: 'text-[#C9A84C] hover:underline font-semibold',
    }

    const children = node.children?.map((c: any, i: number) => renderTextNode(c, i, isDark))

    if (url.startsWith('/') || url.startsWith('#')) {
      return (
        <Link key={index} {...linkProps}>
          {children}
        </Link>
      )
    }
    return (
      <a key={index} {...linkProps}>
        {children}
      </a>
    )
  }

  // An image is a block, never a run of text: `![alt](url)` on its own line is
  // a figure, handled by the block case below. Inside a sentence the parser
  // drops it, so a leaf like this can only be legacy content — render nothing
  // rather than a thumbnail sitting on the baseline mid-sentence.
  if (node.type === 'image' || node.type === 'video') return null

  if (node.type === 'linebreak') return <br key={index} />

  const text = node.text || ''
  const format = node.format || 0

  let element: React.ReactNode = text
  if ((format & 16) !== 0)
    element = (
      <code
        className={`px-1.5 py-0.5 rounded text-[0.9em] font-mono ${
          isDark ? 'bg-white/15 text-white' : 'bg-[#0D1B2A]/6 text-[#0D1B2A]'
        }`}
      >
        {element}
      </code>
    )
  if ((format & 1) !== 0)
    element = <strong className={isDark ? 'font-bold text-white' : 'font-bold text-[#0D1B2A]'}>{element}</strong>
  if ((format & 2) !== 0) element = <em className="italic">{element}</em>
  if ((format & 4) !== 0)
    element = (
      <span className={isDark ? 'line-through text-white/50' : 'line-through text-[#0D1B2A]/40'}>
        {element}
      </span>
    )
  if ((format & 8) !== 0) element = <span className="underline">{element}</span>

  return <React.Fragment key={index}>{element}</React.Fragment>
}

function renderInline(nodes: any[], isDark = false): React.ReactNode {
  return (nodes || []).map((c: any, i: number) => renderTextNode(c, i, isDark))
}

/* ─────────────────────────────── Callouts ───────────────────────────────── */

const CALLOUT_STYLES: Record<
  string,
  { border: string; bg: string; accent: string; label: string; icon: React.ReactNode }
> = {
  note: {
    border: 'border-slate-300',
    bg: 'bg-slate-50',
    accent: 'text-slate-700',
    label: 'Note',
    icon: (
      <path d="M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
  },
  tip: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    accent: 'text-emerald-800',
    label: 'Tip',
    icon: <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />,
  },
  warning: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    accent: 'text-amber-900',
    label: 'Warning',
    icon: (
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    ),
  },
  key: {
    border: 'border-[#C9A84C]',
    bg: 'bg-[#C9A84C]/10',
    accent: 'text-[#0D1B2A]',
    label: 'Key point',
    icon: <path d="m9 12 2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
}

function Callout({ node, index }: { node: any; index: number }) {
  const style = CALLOUT_STYLES[node.variant] || CALLOUT_STYLES.note
  return (
    <div
      key={index}
      className={`my-8 rounded-2xl border-l-4 ${style.border} ${style.bg} px-6 py-5 shadow-sm`}
    >
      <div className={`flex items-center gap-2 mb-2 font-headline font-bold ${style.accent}`}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {style.icon}
        </svg>
        <span className="text-sm uppercase tracking-wider">{node.title || style.label}</span>
      </div>
      <div className="[&>p:last-child]:mb-0">{renderBlocks(node.blocks || [])}</div>
    </div>
  )
}

/* ────────────────────────────── Key takeaways ───────────────────────────── */

function Takeaways({ node, index }: { node: any; index: number }) {
  return (
    <aside
      key={index}
      id={anchorId(node.title || 'Key Takeaways')}
      className="my-10 rounded-3xl bg-[#0D1B2A] px-6 py-7 sm:px-8 sm:py-8 shadow-lg scroll-mt-24"
      style={{ border: `1px solid ${GOLD}33` }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: GOLD }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={NAVY}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 12 2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <h2 className="font-headline text-2xl sm:text-[28px] font-bold text-white m-0">
          {node.title || 'Key Takeaways'}
        </h2>
      </div>

      {(node.intro || []).map((run: any[], i: number) => (
        <p key={i} className="text-white/75 leading-relaxed mb-4 font-body">
          {renderInline(run, true)}
        </p>
      ))}

      <ul className="space-y-4 list-none pl-0 m-0 border-t border-white/15 pt-5">
        {(node.items || []).map((run: any[], i: number) => (
          <li key={i} className="flex gap-3 items-start text-white/90 font-body leading-relaxed">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={GOLD}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-1 shrink-0"
              aria-hidden="true"
            >
              <path d="m9 12 2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span>{renderInline(run, true)}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/* ───────────────────────────────── FAQ ──────────────────────────────────── */

function Faq({ node, index }: { node: any; index: number }) {
  return (
    <section key={index} id={anchorId(node.title || 'FAQ')} className="my-10 scroll-mt-24">
      <h2 className="font-headline text-[22px] md:text-[26px] font-bold text-[#0D1B2A] tracking-tight mb-5 scroll-mt-24">
        {node.title || 'Frequently Asked Questions'}
      </h2>
      <div className="space-y-3">
        {(node.items || []).map((item: any, i: number) => (
          <details
            key={i}
            className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:shadow-md transition-shadow"
          >
            <summary className="cursor-pointer list-none font-headline font-bold text-[#0D1B2A] flex items-start justify-between gap-4">
              <span>{item.question}</span>
              <span className="text-[#C9A84C] shrink-0 transition-transform group-open:rotate-45 text-xl leading-none">
                +
              </span>
            </summary>
            <div className="mt-3 [&>p:last-child]:mb-0">{renderBlocks(item.answer || [])}</div>
          </details>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────────── Lists ──────────────────────────────────── */

function renderList(node: any, index: number): React.ReactNode {
  const ordered = node.listType === 'number'
  const ListTag = ordered ? 'ol' : 'ul'
  const listClass = ordered
    ? 'list-decimal pl-6 my-5 text-[#0D1B2A]/70 space-y-2.5 font-body'
    : 'list-disc pl-6 my-5 text-[#0D1B2A]/70 space-y-2.5 font-body'

  return (
    <ListTag
      key={index}
      className={listClass}
      start={ordered && node.start > 1 ? node.start : undefined}
    >
      {(node.children || []).map((item: any, i: number) => {
        if (item?.type !== 'listitem') return null
        const nested = (item.children || []).filter((c: any) => c?.type === 'list')
        const inline = (item.children || []).filter((c: any) => c?.type !== 'list')
        return (
          <li key={i} className="text-base leading-relaxed">
            {renderInline(inline)}
            {nested.map((child: any, j: number) => renderList(child, j))}
          </li>
        )
      })}
    </ListTag>
  )
}

/* ─────────────────────────────── Blocks ─────────────────────────────────── */

function renderBlock(node: any, index: number): React.ReactNode {
  if (!node) return null

  switch (node.type) {
    case 'youtube':
    case 'embed': {
      const videoId = node.videoID || node.videoId || node.id || ''
      if (!videoId) return null
      const src =
        node.provider === 'vimeo'
          ? `https://player.vimeo.com/video/${videoId}`
          : `https://www.youtube-nocookie.com/embed/${videoId}`
      return (
        <figure key={index} className="my-8">
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-md border border-slate-200/50">
            <iframe
              src={src}
              title={node.title || 'Embedded video'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
          {node.title ? (
            <figcaption className="mt-3 text-sm text-[#0D1B2A]/50 font-body italic text-center">
              {node.title}
            </figcaption>
          ) : null}
        </figure>
      )
    }

    case 'image': {
      const imageUrl = node.url || node.src || ''
      if (!imageUrl) return null
      return (
        <figure key={index} className="w-full my-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={node.alt || 'Blog image'}
            className="mx-auto rounded-2xl shadow-md border border-slate-200/50 object-contain max-h-[500px]"
            style={{ maxWidth: node.width ? `${node.width}px` : '100%', height: 'auto' }}
          />
          {node.caption ? (
            <figcaption className="mt-3 text-sm text-[#0D1B2A]/50 font-body italic">
              {node.caption}
            </figcaption>
          ) : null}
        </figure>
      )
    }

    case 'video':
      return (
        <figure key={index} className="my-8">
          <video
            src={node.url}
            controls
            preload="metadata"
            className="w-full rounded-2xl shadow-md border border-slate-200/50 max-h-[500px]"
          />
          {node.caption ? (
            <figcaption className="mt-3 text-sm text-[#0D1B2A]/50 font-body italic text-center">
              {node.caption}
            </figcaption>
          ) : null}
        </figure>
      )

    case 'code': {
      const text = (node.children || []).map((c: any) => c?.text || '').join('')
      return (
        <div key={index} className="my-6 rounded-xl overflow-hidden border border-slate-200/70">
          {node.language ? (
            <div className="px-4 py-1.5 bg-[#0D1B2A]/8 text-[#0D1B2A]/60 text-[11px] font-mono uppercase tracking-wider border-b border-slate-200/70">
              {node.language}
            </div>
          ) : null}
          <pre className="bg-[#0D1B2A]/6 text-[#0D1B2A] p-4 font-mono text-sm overflow-x-auto m-0">
            <code>{text}</code>
          </pre>
        </div>
      )
    }

    case 'horizontalrule':
    case 'horizontalRule':
      return <hr key={index} className="my-10 border-0 h-px bg-slate-200" />

    case 'paragraph':
      return (
        <p
          key={index}
          className="text-[#0D1B2A]/70 leading-[1.9] text-base md:text-[17px] mb-6 last:mb-0 font-body"
        >
          {renderInline(node.children)}
        </p>
      )

    case 'heading': {
      const Tag = (node.tag || 'h3') as keyof React.JSX.IntrinsicElements
      const level = parseInt(String(node.tag || 'h3').slice(1), 10) || 3
      const id =
        node.id ||
        (node.children || [])
          .map((c: any) => c?.text || '')
          .join('')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')

      const classes =
        level === 1
          ? 'font-headline text-[28px] md:text-[32px] font-bold text-[#0D1B2A] tracking-tight mt-10 mb-5 leading-snug scroll-mt-24'
          : level === 2
            ? 'font-headline text-[22px] md:text-[26px] font-bold text-[#0D1B2A] tracking-tight mt-8 mb-4 leading-snug scroll-mt-24'
            : level === 3
              ? 'font-headline text-[18px] md:text-[20px] font-bold text-[#0D1B2A] mt-6 mb-3 leading-snug scroll-mt-24'
              : 'font-headline text-[16px] md:text-[17px] font-bold text-[#0D1B2A]/85 mt-5 mb-2 leading-snug scroll-mt-24'

      return (
        <Tag key={index} id={id} className={classes}>
          {renderInline(node.children)}
        </Tag>
      )
    }

    case 'quote': {
      const hasBlocks = Array.isArray(node.blocks) && node.blocks.length > 0
      return (
        <blockquote
          key={index}
          className="border-l-[3px] border-[#C9A84C] pl-6 py-4 my-8 italic text-[#0D1B2A]/80 bg-[#C9A84C]/6 rounded-r-xl font-headline text-lg leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0 [&>p]:text-[#0D1B2A]/80"
        >
          {hasBlocks ? renderBlocks(node.blocks) : renderInline(node.children)}
        </blockquote>
      )
    }

    case 'list':
      return renderList(node, index)

    case 'table': {
      const rows = (node.children || []).filter((r: any) => r?.type === 'tablerow')
      const align: string[] = Array.isArray(node.align) ? node.align : []
      return (
        <div
          key={index}
          className="overflow-x-auto my-6 border border-slate-200/80 rounded-xl shadow-sm"
        >
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="divide-y divide-slate-100">
              {rows.map((row: any, rIdx: number) => {
                const isHeader =
                  rIdx === 0 ||
                  (row.children || []).every((c: any) => c?.headerState === 1)
                return (
                  <tr key={rIdx} className={isHeader ? 'bg-slate-50/75' : 'hover:bg-slate-50/20'}>
                    {(row.children || []).map((cell: any, cIdx: number) => {
                      if (cell?.type !== 'tablecell') return null
                      const CellTag = isHeader ? 'th' : 'td'
                      const a = align[cIdx] || 'left'
                      return (
                        <CellTag
                          key={cIdx}
                          style={{ textAlign: a as any }}
                          className={`px-4 py-3 font-body ${
                            isHeader
                              ? 'text-[#0D1B2A] font-bold text-xs uppercase tracking-wider bg-slate-50/60'
                              : 'text-[#0D1B2A]/70 font-normal'
                          }`}
                        >
                          {renderInline(cell.children)}
                        </CellTag>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    case 'callout':
      return <Callout key={index} node={node} index={index} />

    case 'takeaways':
      return <Takeaways key={index} node={node} index={index} />

    case 'faq':
      return <Faq key={index} node={node} index={index} />

    default:
      return null
  }
}

function renderBlocks(nodes: any[]): React.ReactNode {
  return (nodes || []).map((node: any, index: number) => renderBlock(node, index))
}

export function renderContent(content: any): React.ReactNode {
  if (!content) return null
  if (typeof content === 'string') return <p className="prose-wca">{content}</p>
  try {
    return renderBlocks(content.root?.children || [])
  } catch {
    return <p className="text-[#0D1B2A]/60 font-body">Unable to render content.</p>
  }
}

/**
 * Headings for the sidebar table of contents. A Key Takeaways box and an FAQ
 * are their own blocks rather than headings, so both are added explicitly —
 * otherwise they would vanish from the outline the moment they got their box.
 */
export function extractHeadings(content: any) {
  if (!content || typeof content === 'string') return []
  try {
    const children = content.root?.children || []
    const out: { text: string; id: string; tag: string }[] = []

    for (const node of children) {
      if (node?.type === 'heading') {
        const text = (node.children || []).map((c: any) => c?.text || '').join('')
        if (!text.trim()) continue
        out.push({
          text,
          id:
            node.id ||
            text
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, ''),
          tag: node.tag || 'h3',
        })
      } else if (node?.type === 'takeaways' || node?.type === 'faq') {
        const text = node.title || (node.type === 'faq' ? 'FAQ' : 'Key Takeaways')
        out.push({
          text,
          id: text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, ''),
          tag: 'h2',
        })
      }
    }
    return out
  } catch {
    return []
  }
}
