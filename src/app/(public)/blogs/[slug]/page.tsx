import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { cleanImageUrl } from '@/utils/cleanImageUrl'
import ShareBar from '@/components/ShareBar'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// Rich helper to render Lexical rich text with WCA typography
function renderTextNode(node: any, index: number) {
  if (!node) return null

  if (node.type === 'link') {
    const url = node.fields?.url || ''
    const rel = node.fields?.rel || []
    const isNofollow = Array.isArray(rel) ? rel.includes('nofollow') : rel === 'nofollow'
    const newTab = node.fields?.newTab || url.startsWith('http')
    
    const linkProps = {
      href: url,
      target: newTab ? '_blank' : undefined,
      rel: `${newTab ? 'noopener noreferrer ' : ''}${isNofollow ? 'nofollow' : ''}`.trim() || undefined,
      className: 'text-[#C9A84C] hover:underline font-semibold'
    }
    
    const children = node.children?.map((c: any, i: number) => renderTextNode(c, i))
    
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

  const text = node.text || ''
  const format = node.format || 0

  const isBold = (format & 1) !== 0
  const isItalic = (format & 2) !== 0
  const isStrikethrough = (format & 4) !== 0
  const isUnderline = (format & 8) !== 0
  const isCode = (format & 16) !== 0

  let element: React.ReactNode = text

  if (isBold) element = <strong className="font-bold text-[#0D1B2A]">{element}</strong>
  if (isItalic) element = <em className="italic">{element}</em>
  if (isStrikethrough) element = <span className="line-through text-[#0D1B2A]/40">{element}</span>
  if (isUnderline) element = <span className="underline">{element}</span>
  if (isCode) element = <code className="bg-[#0D1B2A]/6 text-[#0D1B2A] px-1.5 py-0.5 rounded text-xs font-mono">{element}</code>

  return <React.Fragment key={index}>{element}</React.Fragment>
}

function renderContent(content: any) {
  if (!content) return null

  if (typeof content === 'string') {
    return <p className="prose-wca">{content}</p>
  }

  try {
    const children = content.root?.children || []
    return children.map((node: any, index: number) => {
      if (!node) return null

      if (node.type === 'paragraph') {
        return (
          <p key={index} className="text-[#0D1B2A]/70 leading-[1.9] text-base md:text-[17px] mb-6 last:mb-0 font-body">
            {node.children?.map((c: any, i: number) => renderTextNode(c, i))}
          </p>
        )
      }

      if (node.type === 'heading') {
        const Tag = node.tag || 'h3'
        const text = node.children?.map((c: any) => c.text || '').join('') || ''
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const classes =
          Tag === 'h1' ? 'font-headline text-[28px] md:text-[32px] font-bold text-[#0D1B2A] tracking-tight mt-10 mb-5 leading-snug scroll-mt-24' :
          Tag === 'h2' ? 'font-headline text-[22px] md:text-[26px] font-bold text-[#0D1B2A] tracking-tight mt-8 mb-4 leading-snug scroll-mt-24' :
          'font-headline text-[18px] md:text-[20px] font-bold text-[#0D1B2A] mt-6 mb-3 leading-snug scroll-mt-24'

        return (
          <Tag key={index} id={id} className={classes}>
            {node.children?.map((c: any, i: number) => renderTextNode(c, i))}
          </Tag>
        )
      }

      if (node.type === 'quote') {
        return (
          <blockquote key={index} className="border-l-[3px] border-[#C9A84C] pl-6 py-4 my-8 italic text-[#0D1B2A]/80 bg-[#C9A84C]/6 rounded-r-xl font-headline text-lg leading-relaxed">
            {node.children?.map((c: any, i: number) => renderTextNode(c, i))}
          </blockquote>
        )
      }

      if (node.type === 'list') {
        const ListTag = node.listType === 'number' ? 'ol' : 'ul'
        const listClass = node.listType === 'number'
          ? 'list-decimal pl-6 my-5 text-[#0D1B2A]/70 space-y-2.5 font-body'
          : 'list-disc pl-6 my-5 text-[#0D1B2A]/70 space-y-2.5 font-body'

        return (
          <ListTag key={index} className={listClass}>
            {node.children?.map((item: any, i: number) => {
              if (item.type === 'listitem') {
                return (
                  <li key={i} className="text-base leading-relaxed">
                    {item.children?.map((c: any, j: number) => renderTextNode(c, j))}
                  </li>
                )
              }
              return null
            })}
          </ListTag>
        )
      }

      if (node.type === 'table') {
        return (
          <div key={index} className="overflow-x-auto my-6 border border-slate-200/80 rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <tbody className="divide-y divide-slate-100">
                {node.children?.map((row: any, rIdx: number) => {
                  if (row.type === 'tablerow') {
                    const isHeader = rIdx === 0
                    return (
                      <tr key={rIdx} className={isHeader ? 'bg-slate-50/75' : 'hover:bg-slate-50/20'}>
                        {row.children?.map((cell: any, cIdx: number) => {
                          if (cell.type === 'tablecell') {
                            const CellTag = isHeader ? 'th' : 'td'
                            return (
                              <CellTag
                                key={cIdx}
                                className={`px-4 py-3 text-left font-body ${
                                  isHeader
                                    ? 'text-[#0D1B2A] font-bold text-xs uppercase tracking-wider bg-slate-50/60'
                                    : 'text-[#0D1B2A]/70 font-normal'
                                }`}
                              >
                                {cell.children?.map((c: any, i: number) => renderTextNode(c, i))}
                              </CellTag>
                            )
                          }
                          return null
                        })}
                      </tr>
                    )
                  }
                  return null
                })}
              </tbody>
            </table>
          </div>
        )
      }

      return null
    })
  } catch (err) {
    return <p className="text-[#0D1B2A]/60 font-body">Unable to render content.</p>
  }
}

function extractHeadings(content: any) {
  if (!content || typeof content === 'string') return []
  try {
    const children = content.root?.children || []
    return children
      .filter((node: any) => node.type === 'heading')
      .map((node: any) => {
        const text = node.children?.map((c: any) => c.text || '').join('') || ''
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
        return {
          text,
          id,
          tag: node.tag || 'h3',
        }
      })
      .filter((h: any) => h.text.trim().length > 0)
  } catch (err) {
    return []
  }
}

export default async function BlogDetailsPage({ params }: PageProps) {
  const { slug } = await params
  let post: any = null
  let moreReads: any[] = []

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

  try {
    const payload = await getPayload({ config })
    const postsResult = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      depth: 1,
      overrideAccess: true,
    })

    if (postsResult.docs.length > 0) {
      post = postsResult.docs[0]
      // Increment views count in the background without blocking the page load
      payload.update({
        collection: 'posts',
        id: post.id,
        data: { views: (post.views || 0) + 1 },
        overrideAccess: true,
      }).catch(err => console.error('Failed to increment view count:', err))
    }

    // Fetch up to 10 posts, then filter down to 4 matching "published" and excluding the current one
    const moreReadsResult = await payload.find({
      collection: 'posts',
      limit: 10,
      depth: 1,
      overrideAccess: true,
    })

    moreReads = moreReadsResult.docs
      .filter((p: any) => p.slug !== slug && p.stage && typeof p.stage === 'object' && p.stage.key === 'published')
      .slice(0, 4)
      .map((p: any) => {
        let coverImageUrl = cleanImageUrl(p.coverImageUrl) || null
        if (!coverImageUrl && p.coverImage?.url) {
          const raw = p.coverImage.url as string
          coverImageUrl = raw.startsWith('http') ? raw : `${serverUrl}${raw}`
        }
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          readTime: p.readTime || '5 min read',
          targetRole: p.targetRole || 'General',
          coverImageUrl,
        }
      })
  } catch (err) {
    console.error('Error loading blog details from Payload CMS:', err)
  }

  if (!post) return notFound()

  const headings = extractHeadings(post.content)
  const currentUrl = `${serverUrl}/blogs/${post.slug}`

  const formattedDate = post.publishDate
    ? new Date(post.publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Recently Published'

  let resolvedCoverImageUrl = cleanImageUrl(post.coverImageUrl) || null
  if (!resolvedCoverImageUrl && post.coverImage?.url) {
    const raw = post.coverImage.url as string
    resolvedCoverImageUrl = raw.startsWith('http') ? raw : `${serverUrl}${raw}`
  }

  const authorAvatar = cleanImageUrl(post.author?.avatar) || null

  return (
    <div className="min-h-screen bg-[#F5F0E8]">

      {/* ── Article Hero ── */}
      <div className="relative bg-[#0D1B2A] text-white overflow-hidden">
        {/* Subtle gold radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,_rgba(201,168,76,0.06),_transparent_55%)] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />

        <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] pt-10 pb-16 relative z-10">

          {/* Back link */}
          <Link
            href="/blogs"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]/70 hover:text-[#C9A84C] transition-colors duration-200 group mb-10"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to The Archive
          </Link>

          <div className="max-w-4xl">
            {/* Category badge */}
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-[#C9A84C]/25 text-[#C9A84C] bg-[#C9A84C]/10">
                {post.targetRole || 'Insight'}
              </span>
              <span className="text-[10px] text-white/35 font-body">{post.readTime || '5 min read'}</span>
            </div>

            {/* Title */}
            <h1 className="font-headline text-[32px] sm:text-[40px] md:text-[52px] font-bold leading-[1.1] text-white mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-white/55 text-base md:text-lg leading-relaxed font-body max-w-3xl">
                {post.excerpt}
              </p>
            )}

            {/* Author + meta */}
            <div className="flex items-center gap-5 mt-8 pt-8 border-t border-white/[0.08]">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={post.author?.name}
                  className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white/25" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white/90 leading-tight">{post.author?.name || 'Justin Paperny'}</p>
                <p className="text-[10px] text-white/40 font-body mt-0.5">{post.author?.role || 'White Collar Advice'} · {formattedDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Article Content ── */}
      <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

          {/* Main content */}
          <article className="lg:col-span-8 space-y-8 relative">

            {/* Sticky vertical share bar on desktop (xl and up) */}
            <div className="hidden xl:block absolute -left-16 top-0 bottom-0 w-10 z-30 pointer-events-none">
              <div className="sticky top-36 pointer-events-auto">
                <ShareBar url={currentUrl} title={post.title} />
              </div>
            </div>

            {resolvedCoverImageUrl && (
              <div className="w-full overflow-hidden rounded-2xl shadow-lg border border-[rgba(13,27,42,0.08)]">
                <img
                  src={resolvedCoverImageUrl}
                  alt={post.title}
                  className="w-full h-auto max-h-[480px] object-cover"
                />
              </div>
            )}
            <div className="bg-white rounded-2xl border border-[rgba(13,27,42,0.08)] shadow-sm p-8 md:p-12">

              {/* Horizontal share bar for mobile / tablet (hidden on xl) */}
              <div className="xl:hidden border-b border-[rgba(13,27,42,0.08)] pb-4 mb-6 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0D1B2A]/40 font-body">Share Article</span>
                <ShareBar url={currentUrl} title={post.title} />
              </div>

              {/* Table of Contents */}
              {headings.length > 0 && (
                <div className="lg:hidden mb-10 p-6 md:p-8 bg-[#F5F0E8]/50 border border-[#C9A84C]/35 rounded-2xl">
                  <h3 className="font-headline text-base md:text-lg font-bold text-[#0D1B2A] mb-4 pb-2 border-b border-[#C9A84C]/25 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z" />
                    </svg>
                    Table of Contents
                  </h3>
                  <nav className="space-y-2">
                    {headings.map((h: any, idx: number) => {
                      const isH1 = h.tag === 'h1'
                      const isH2 = h.tag === 'h2'
                      const indentClass = isH1 ? 'pl-0 font-bold' : isH2 ? 'pl-4 font-semibold text-sm' : 'pl-8 text-[13px] text-[#0D1B2A]/70'
                      return (
                        <a
                          key={idx}
                          href={`#${h.id}`}
                          className={`block text-[#0D1B2A]/85 hover:text-[#C9A84C] transition-colors duration-200 font-body ${indentClass}`}
                        >
                          {idx + 1}. {h.text}
                        </a>
                      )
                    })}
                  </nav>
                </div>
              )}

              <div className="prose-wca">
                {renderContent(post.content)}
              </div>
            </div>

            {/* Author card */}
            <div className="mt-8 bg-white rounded-2xl border border-[rgba(13,27,42,0.08)] shadow-sm p-8 flex items-start gap-5">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={post.author?.name}
                  className="w-14 h-14 rounded-full object-cover border border-[rgba(13,27,42,0.1)] flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#0D1B2A]/6 border border-[rgba(13,27,42,0.1)] flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-[#0D1B2A]/25" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
              )}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[3px] text-[#C9A84C] mb-1">Written by</p>
                <p className="font-headline text-lg font-bold text-[#0D1B2A]">{post.author?.name || 'Justin Paperny'}</p>
                <p className="text-sm text-[#0D1B2A]/50 font-body mt-0.5">
                  {post.author?.role || 'White Collar Advice'}{post.author?.department ? ` · ${post.author.department}` : ''}
                </p>
              </div>
            </div>

            {/* Back link bottom */}
            <div className="mt-8">
              <Link
                href="/blogs"
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] hover:text-[#B29135] transition-colors duration-200 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back to The Archive
              </Link>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">

              {/* Desktop Table of Contents */}
              {headings.length > 0 && (
                <div className="hidden lg:block bg-white rounded-2xl border border-[rgba(13,27,42,0.08)] shadow-sm p-6 space-y-4">
                  <h4 className="text-[9px] font-bold uppercase tracking-[3px] text-[#0D1B2A]/40 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#C9A84C]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z" />
                    </svg>
                    Table of Contents
                  </h4>
                  <nav className="space-y-2.5">
                    {headings.map((h: any, idx: number) => {
                      const isH1 = h.tag === 'h1'
                      const isH2 = h.tag === 'h2'
                      const indentClass = isH1 ? 'pl-0 font-bold text-xs' : isH2 ? 'pl-3 font-semibold text-xs' : 'pl-6 text-[11px] text-[#0D1B2A]/70'
                      return (
                        <a
                          key={idx}
                          href={`#${h.id}`}
                          className="block text-[#0D1B2A]/80 hover:text-[#C9A84C] transition-colors duration-200 font-body pl-0 font-bold text-xs"
                        >
                          {idx + 1}. {h.text}
                        </a>
                      )
                    })}
                  </nav>
                </div>
              )}

              {/* Article meta */}
              <div className="bg-white rounded-2xl border border-[rgba(13,27,42,0.08)] shadow-sm p-6 space-y-4">
                <h4 className="text-[9px] font-bold uppercase tracking-[3px] text-[#0D1B2A]/40">Article Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#0D1B2A]/40 font-body">Published</span>
                    <span className="text-xs font-bold text-[#0D1B2A]">{formattedDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#0D1B2A]/40 font-body">Read time</span>
                    <span className="text-xs font-bold text-[#0D1B2A]">{post.readTime || '5 min read'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#0D1B2A]/40 font-body">Category</span>
                    <span className="wca-badge">{post.targetRole || 'Insight'}</span>
                  </div>
                </div>
              </div>

              {/* CTA Box */}
              <div className="bg-[#0D1B2A] rounded-2xl border border-[#C9A84C]/20 p-7 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
                <p className="text-[9px] font-bold uppercase tracking-[3px] text-[#C9A84C]/70 mb-3">Ready to Begin?</p>
                <h4 className="font-headline text-xl font-bold text-white mb-3 leading-snug">
                  One hour. $500.<br />
                  <span className="text-[#C9A84C]">I will tell you what to do next.</span>
                </h4>
                <p className="text-xs text-white/50 leading-relaxed font-body mb-6">
                  If the call gives you nothing useful, I refund it.
                </p>
                <a
                  href="https://website-ten-sigma-61.vercel.app/"
                  className="wca-btn-gold w-full justify-center"
                >
                  Book Strategy Session
                </a>
                <p className="text-center mt-4 text-[10px] text-white/30">
                  Call or text: <a href="tel:9497993277" className="text-[#C9A84C]/60 hover:text-[#C9A84C]">949-799-3277</a>
                </p>
              </div>

              {/* Browse more */}
              <div className="bg-white rounded-2xl border border-[rgba(13,27,42,0.08)] shadow-sm p-6">
                <h4 className="text-[9px] font-bold uppercase tracking-[3px] text-[#0D1B2A]/40 mb-4">Browse The Archive</h4>
                <Link
                  href="/blogs"
                  className="flex items-center justify-between group"
                >
                  <span className="text-sm font-bold text-[#0D1B2A] group-hover:text-[#C9A84C] transition-colors">
                    View all articles
                  </span>
                  <svg className="w-4 h-4 text-[#C9A84C] group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </Link>
              </div>

            </div>
          </aside>
        </div>

        {/* ── More Reads Section ── */}
        {moreReads.length > 0 && (
          <div className="border-t border-[rgba(13,27,42,0.08)] mt-16 pt-16 pb-8">
            <h3 className="font-headline text-[26px] md:text-[30px] font-bold text-[#0D1B2A] mb-8">
              More Reads
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {moreReads.map((item) => (
                <Link
                  key={item.id}
                  href={`/blogs/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[14px] border border-[rgba(13,27,42,0.08)] bg-white hover:border-[#C9A84C]/35 hover:-translate-y-1 transition-all duration-300 shadow-sm"
                >
                  <div className="relative w-full h-36 bg-[#0D1B2A] overflow-hidden">
                    {item.coverImageUrl ? (
                      <img
                        src={item.coverImageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0D1B2A] to-[#162233] flex items-center justify-center">
                        <span className="font-headline text-5xl text-[#C9A84C]/10 font-bold leading-none">"</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2 flex-grow">
                    <div className="flex items-center justify-between text-[9px] text-[#0D1B2A]/40 uppercase tracking-widest font-body">
                      <span className="font-bold text-[#C9A84C]">{item.targetRole}</span>
                      <span>{item.readTime || '5 min read'}</span>
                    </div>
                    <h4 className="font-headline text-[15px] font-bold text-[#0D1B2A] group-hover:text-[#C9A84C] transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
