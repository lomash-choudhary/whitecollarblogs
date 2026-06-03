import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { cleanImageUrl } from '@/utils/cleanImageUrl'

interface PageProps {
  searchParams: Promise<{
    role?: string
    search?: string
  }>
}

export const metadata = {
  title: 'The Archive | White Collar Advice',
  description: 'Federal sentencing insights, prison preparation guides, and re-entry strategies from Justin Paperny and the White Collar Advice team.',
}

export default async function BlogListingPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const activeRole = resolvedSearchParams.role || 'All'
  const searchQuery = resolvedSearchParams.search || ''

  let blogs: any[] = []

  try {
    const payload = await getPayload({ config })
    const postsResult = await payload.find({
      collection: 'posts',
      limit: 100,
      depth: 2,
    })

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
    blogs = postsResult.docs
      .filter((post: any) => post.stage && typeof post.stage === 'object' && post.stage.key === 'published')
      .map((post: any) => {
        let coverImageUrl = cleanImageUrl(post.coverImageUrl) || null
        if (!coverImageUrl && post.coverImage?.url) {
          const raw = post.coverImage.url as string
          coverImageUrl = raw.startsWith('http') ? raw : `${serverUrl}${raw}`
        }
        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || '',
          author: post.author ? {
            ...post.author,
            avatar: cleanImageUrl(post.author.avatar) || null
          } : null,
          publishDate: post.publishDate
            ? new Date(post.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recently',
          readTime: post.readTime || '5 min read',
          targetRole: post.targetRole || 'General',
          coverImageUrl,
          views: post.views || 0,
          likes: post.likes || 0,
        }
      })
  } catch (err) {
    console.error('Error fetching blogs from Payload CMS:', err)
    blogs = []
  }

  const roles = ['All', ...Array.from(new Set(blogs.map(b => b.targetRole).filter(Boolean)))]

  const filteredBlogs = blogs.filter(blog => {
    const matchesRole = activeRole === 'All' || blog.targetRole === activeRole
    const matchesSearch = searchQuery === '' ||
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.targetRole.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  const isSearchActive = searchQuery !== '' || activeRole !== 'All'
  const featuredBlog = !isSearchActive && filteredBlogs.length > 0 ? filteredBlogs[0] : null
  const displayBlogs = featuredBlog ? filteredBlogs.slice(1) : filteredBlogs

  return (
    <div className="w-full">

      {/* ── Hero Banner ── */}
      <section className="relative bg-[#0D1B2A] text-white overflow-hidden">
        {/* Radial glow background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,_rgba(201,168,76,0.07),_transparent_50%),_radial-gradient(circle_at_75%_70%,_rgba(201,168,76,0.04),_transparent_50%)] pointer-events-none" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.01)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.01)_1px,_transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
        {/* Top gold line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />

        <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] py-20 md:py-28 relative z-10">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[5px] text-[#C9A84C] mb-5">
              White Collar Advice · The Archive
            </p>
            <h1 className="font-headline text-[42px] md:text-[58px] lg:text-[68px] font-bold leading-[1.1] text-white mb-6">
              Insights That{' '}
              <span className="text-[#C9A84C] italic font-semibold">Change Outcomes</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-2xl font-body">
              Federal sentencing strategies, prison preparation guides, and re-entry frameworks documented by Justin Paperny and the White Collar Advice team.
            </p>
          </div>
        </div>

        {/* Bottom fade into content */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F5F0E8] to-transparent" />
      </section>

      {/* ── Filters + Search ── */}
      <section id="articles" className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] pt-12 pb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-[rgba(13,27,42,0.1)] pb-8">

          {/* Section heading */}
          <div className="space-y-1">
            <h2 className="font-headline text-2xl font-bold text-[#0D1B2A]">
              {isSearchActive ? 'Search Results' : 'All Articles'}
            </h2>
            <p className="text-sm text-[#0D1B2A]/50 font-body">
              {filteredBlogs.length} article{filteredBlogs.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {/* Search */}
          <form action="/blogs" method="GET" className="relative w-full md:w-80">
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search the archive..."
              className="w-full bg-white border border-[rgba(13,27,42,0.12)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 transition-all duration-300 text-[#0D1B2A] placeholder:text-[#0D1B2A]/30 font-body shadow-sm"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0D1B2A]/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {activeRole !== 'All' && <input type="hidden" name="role" value={activeRole} />}
          </form>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-6 pb-2">
          {roles.map(role => {
            const isActive = activeRole === role
            const params = new URLSearchParams()
            if (role !== 'All') params.set('role', role)
            if (searchQuery) params.set('search', searchQuery)
            const url = `/blogs${params.toString() ? `?${params.toString()}` : ''}#articles`

            return (
              <Link
                key={role}
                href={url}
                className={`px-5 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-all duration-300 ${
                  isActive
                    ? 'bg-[#C9A84C] border-[#C9A84C] text-[#0D1B2A] shadow-md shadow-[#C9A84C]/20'
                    : 'bg-white/80 hover:bg-white border-[rgba(13,27,42,0.12)] text-[#0D1B2A]/60 hover:text-[#0D1B2A] hover:border-[#C9A84C]/40'
                }`}
              >
                {role}
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Content ── */}
      <section className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] py-10 space-y-14">

        {filteredBlogs.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center py-24 gap-6">
            <div className="w-16 h-16 rounded-full border border-[rgba(13,27,42,0.1)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#0D1B2A]/20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="font-headline text-xl font-bold text-[#0D1B2A]">No Articles Found</h3>
              <p className="text-sm text-[#0D1B2A]/50 max-w-sm font-body leading-relaxed">
                No published articles match your current filters. Try a different category or search term.
              </p>
            </div>
            <Link
              href="/blogs#articles"
              className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C] hover:text-[#0D1B2A] px-6 py-3 rounded-full transition-all duration-200"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          <div className="space-y-14">

            {/* ── Featured Post ── */}
            {featuredBlog && (
              <Link
                href={`/blogs/${featuredBlog.slug}`}
                className="group block overflow-hidden rounded-[20px] border border-[rgba(13,27,42,0.1)] hover:border-[#C9A84C]/40 bg-white shadow-sm hover:shadow-xl transition-all duration-500"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {/* Cover image */}
                  <div className="lg:col-span-6 relative min-h-[320px] lg:min-h-[420px] bg-[#0D1B2A] overflow-hidden">
                    {featuredBlog.coverImageUrl ? (
                      <img
                        src={featuredBlog.coverImageUrl}
                        alt={featuredBlog.title}
                        className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0D1B2A] to-[#1a2e42] flex items-center justify-center">
                        <span className="font-headline text-[100px] text-[#C9A84C]/10 font-bold">"</span>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/70 via-[#0D1B2A]/10 to-transparent" />
                    {/* Featured badge */}
                    <div className="absolute top-6 left-6">
                      <span className="bg-[#C9A84C] text-[#0D1B2A] text-[9px] font-bold uppercase tracking-[3px] px-3 py-1.5 rounded-full">
                        Featured
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between gap-8 bg-white">
                    <div className="space-y-5">
                      <div className="flex items-center gap-3">
                        <span className="wca-badge">{featuredBlog.targetRole}</span>
                        <span className="text-[10px] text-[#0D1B2A]/40 font-body">{featuredBlog.readTime}</span>
                      </div>

                      <h3 className="font-headline text-[26px] md:text-[32px] font-bold text-[#0D1B2A] leading-snug group-hover:text-[#C9A84C] transition-colors duration-300">
                        {featuredBlog.title}
                      </h3>

                      <p className="text-sm text-[#0D1B2A]/60 leading-relaxed font-body">
                        {featuredBlog.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[rgba(13,27,42,0.08)] pt-6">
                      <div className="flex items-center gap-3">
                        {featuredBlog.author?.avatar ? (
                          <img
                            src={featuredBlog.author.avatar}
                            alt={featuredBlog.author.name}
                            className="w-10 h-10 rounded-full object-cover border border-[rgba(13,27,42,0.1)]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#0D1B2A]/8 border border-[rgba(13,27,42,0.1)] flex items-center justify-center">
                            <svg className="w-5 h-5 text-[#0D1B2A]/30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#0D1B2A] leading-tight">{featuredBlog.author?.name || 'Justin Paperny'}</p>
                          <p className="text-[10px] text-[#0D1B2A]/40">{featuredBlog.publishDate}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-300">
                        Read More
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* ── Articles Grid ── */}
            {displayBlogs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {displayBlogs.map((blog) => (
                  <Link
                    key={blog.id}
                    href={`/blogs/${blog.slug}`}
                    className="group flex flex-col overflow-hidden rounded-[18px] border border-[rgba(13,27,42,0.1)] hover:border-[#C9A84C]/35 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-400"
                  >
                    {/* Cover image */}
                    <div className="relative w-full h-52 bg-[#0D1B2A] overflow-hidden">
                      {blog.coverImageUrl ? (
                        <img
                          src={blog.coverImageUrl}
                          alt={blog.title}
                          className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0D1B2A] to-[#162233] flex items-center justify-center">
                          <span className="font-headline text-[80px] text-[#C9A84C]/10 font-bold leading-none">"</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    {/* Card body */}
                    <div className="flex flex-col flex-1 p-7 gap-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="wca-badge">{blog.targetRole}</span>
                        <span className="text-[10px] text-[#0D1B2A]/40 font-body">{blog.readTime}</span>
                      </div>

                      <h3 className="font-headline text-[19px] font-bold text-[#0D1B2A] leading-snug group-hover:text-[#C9A84C] transition-colors duration-300 line-clamp-2 flex-1">
                        {blog.title}
                      </h3>

                      <p className="text-sm text-[#0D1B2A]/55 leading-relaxed line-clamp-3 font-body">
                        {blog.excerpt}
                      </p>

                      {/* Author + date */}
                      <div className="flex items-center justify-between border-t border-[rgba(13,27,42,0.07)] pt-4 mt-auto">
                        <div className="flex items-center gap-2.5">
                          {blog.author?.avatar ? (
                            <img
                              src={blog.author.avatar}
                              alt={blog.author.name}
                              className="w-8 h-8 rounded-full object-cover border border-[rgba(13,27,42,0.1)]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#0D1B2A]/8 border border-[rgba(13,27,42,0.1)] flex items-center justify-center">
                              <svg className="w-4 h-4 text-[#0D1B2A]/30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-bold text-[#0D1B2A]/70 leading-tight">{blog.author?.name || 'Justin Paperny'}</p>
                            <p className="text-[9px] text-[#0D1B2A]/40">{blog.publishDate}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform duration-300">
                          Read
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-[#0D1B2A] py-16 mt-8">
        <div className="max-w-[1280px] mx-auto px-[clamp(1.25rem,4vw,2.5rem)] flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[4px] text-[#C9A84C]">Ready to Begin?</p>
            <h3 className="font-headline text-2xl md:text-3xl font-bold text-white">
              $500 for one hour.<br />
              <span className="text-white/60 font-body text-base font-normal">I will tell you exactly where you stand and what to do next.</span>
            </h3>
          </div>
          <a
            href="https://website-ten-sigma-61.vercel.app/"
            className="flex-shrink-0 wca-btn-gold text-center whitespace-nowrap"
          >
            Book Strategy Session
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  )
}
