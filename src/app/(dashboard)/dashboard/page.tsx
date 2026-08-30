import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getActiveSite, siteWhere } from '@/utils/activeSite'
import { 
  CheckCircle2, 
  Users, 
  ArrowRight, 
  BookOpen, 
  Flame
} from 'lucide-react'


export default async function DashboardPage() {
  const activeSite = await getActiveSite()
  let posts: any[] = []
  let stats = {
    total: 0,
    published: 0,
    review: 0,
    draft: 0,
    scheduled: 0,
  }

  try {
    const payload = await getPayload({ config })
    const postsResult = await payload.find({
      collection: 'posts',
      where: siteWhere(activeSite.key),
      limit: 10,
      depth: 1,
    })

    posts = postsResult.docs

    // Dynamic stats aggregation
    posts.forEach((post: any) => {
      const key = post.stage?.key || 'draft'
      stats.total++
      if (key === 'published') stats.published++
      else if (key === 'review') stats.review++
      else if (key === 'draft') stats.draft++
      else if (key === 'scheduled') stats.scheduled++
      else if (key === 'approved') stats.review++ // Treat approved as in-pipeline/review
    })
  } catch (err) {
    console.error('Error fetching dashboard posts from Payload CMS:', err)
    posts = []
    stats = {
      total: 0,
      published: 0,
      review: 0,
      draft: 0,
      scheduled: 0,
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-left">

      {/* Numerical Metrics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 flex items-center gap-4 rounded-2xl border border-[rgba(13,27,42,0.1)] shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#0D1B2A]/40 uppercase tracking-widest">Total Blogs</p>
            <p className="text-2xl font-bold text-[#0D1B2A] mt-1 leading-none">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 flex items-center gap-4 rounded-2xl border border-[rgba(13,27,42,0.1)] shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#0D1B2A]/40 uppercase tracking-widest">Published</p>
            <p className="text-2xl font-bold text-[#0D1B2A] mt-1 leading-none">{stats.published}</p>
          </div>
        </div>

        <div className="bg-white p-6 flex items-center gap-4 rounded-2xl border border-[rgba(13,27,42,0.1)] shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#0D1B2A]/40 uppercase tracking-widest">Under Review</p>
            <p className="text-2xl font-bold text-[#0D1B2A] mt-1 leading-none">{stats.review}</p>
          </div>
        </div>

        <div className="bg-white p-6 flex items-center gap-4 rounded-2xl border border-[rgba(13,27,42,0.1)] shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#0D1B2A]/40 uppercase tracking-widest">Drafts / Scheduled</p>
            <p className="text-2xl font-bold text-[#0D1B2A] mt-1 leading-none">{stats.draft + stats.scheduled}</p>
          </div>
        </div>
      </div>

      {/* Main Container: Recent Blogs */}
      <div className="w-full">
        <div className="small-group-card p-8 bg-white flex flex-col gap-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <h3 className="text-base font-black text-[#090d16] tracking-tight">Recent Blogs in Pipeline</h3>
              <p className="text-xs text-slate-400 font-semibold">Tracking candidate-facing articles</p>
            </div>
            <Link
              href="/blogs"
              className="text-xs font-black uppercase tracking-wider text-[#C9A84C] hover:text-[#B29135] flex items-center gap-1.5 transition-colors group"
            >
              <span>View all blogs</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Articles in Pipeline</p>
                <p className="text-xs text-slate-400">Start by writing a new blog from the Content Editor.</p>
              </div>
            ) : (
              posts.map((post: any) => (
                <div 
                  key={post.id} 
                  className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100/80 hover:bg-slate-50/50 hover:border-slate-200 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold shrink-0">
                    {post.title.charAt(0)}
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <span 
                        className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border"
                        style={{ 
                          backgroundColor: `${post.stage?.color || '#cbd5e1'}15`, 
                          borderColor: `${post.stage?.color || '#cbd5e1'}30`,
                          color: post.stage?.color || '#64748b'
                        }}
                      >
                        {post.stage?.name || 'Draft'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-semibold">{post.readTime || '5 min read'}</span>
                        <span className="text-slate-200">|</span>
                        <Link 
                          href={`/editor?id=${post.id}`} 
                          className="text-[10px] font-black uppercase tracking-widest text-[#C9A84C] hover:text-[#B29135] transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-[#0D1B2A] group-hover:text-[#C9A84C] transition-colors line-clamp-1">
                      {post.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      <span>By {post.author?.name || 'System'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="bg-[#C9A84C]/10 px-2 py-0.5 rounded-full text-[#C9A84C] border border-[#C9A84C]/15">{post.targetRole || 'Generic'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
