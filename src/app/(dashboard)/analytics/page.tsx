import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { 
  Eye, 
  Heart, 
  TrendingUp, 
  Users 
} from 'lucide-react'

// Simple zero stats fallback for analytics
const fallbackStats = {
  views: 0,
  likes: 0,
  avgReadTime: '0 min',
  pipelineStages: [
    { name: 'Draft', count: 0, color: '#64748b', percentage: 0 },
    { name: 'In Review', count: 0, color: '#f59e0b', percentage: 0 },
    { name: 'Approved', count: 0, color: '#0d9488', percentage: 0 },
    { name: 'Scheduled', count: 0, color: '#0f172a', percentage: 0 },
    { name: 'Published', count: 0, color: '#10b981', percentage: 0 },
  ],
  popularPosts: [] as any[]
}

export default async function AnalyticsPage() {
  let stats = fallbackStats

  try {
    const payload = await getPayload({ config })
    const postsResult = await payload.find({
      collection: 'posts',
      limit: 100,
      depth: 2,
    })

    const posts = postsResult.docs

    if (posts.length > 0) {
      let views = 0
      let likes = 0
      let totalReadTimeMinutes = 0
      
      const stageCounts: { [key: string]: { name: string, count: number, color: string } } = {
        draft: { name: 'Draft', count: 0, color: '#64748b' },
        review: { name: 'In Review', count: 0, color: '#f59e0b' },
        approved: { name: 'Approved', count: 0, color: '#0d9488' },
        scheduled: { name: 'Scheduled', count: 0, color: '#0f172a' },
        published: { name: 'Published', count: 0, color: '#10b981' },
      }

      posts.forEach((post: any) => {
        views += (post.views || 0)
        likes += (post.likes || 0)
        
        // Extract integer read time
        const readTimeStr = post.readTime || '5 min'
        const mins = parseInt(readTimeStr) || 5
        totalReadTimeMinutes += mins

        const stageKey = post.stage?.key || 'draft'
        if (stageCounts[stageKey]) {
          stageCounts[stageKey].count++
        } else {
          stageCounts[stageKey] = {
            name: post.stage?.name || 'Unknown',
            count: 1,
            color: post.stage?.color || '#64748b'
          }
        }
      })

      const totalPosts = posts.length
      const pipelineStages = Object.values(stageCounts).map(s => ({
        ...s,
        percentage: totalPosts > 0 ? Math.round((s.count / totalPosts) * 100) : 0
      }))

      const popularPosts = [...posts]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 3)
        .map((p: any) => ({
          title: p.title,
          views: p.views || 0,
          likes: p.likes || 0,
          role: p.targetRole || 'General'
        }))

      stats = {
        views,
        likes,
        avgReadTime: `${Math.round((totalReadTimeMinutes / totalPosts) * 10) / 10} min`,
        pipelineStages,
        popularPosts,
      }
    }
  } catch (err) {
    console.error('Error fetching analytics from Payload, using fallback:', err)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-left">
      {/* Page Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-black text-[#090d16] tracking-tight">Recruitment Editorial Analytics</h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">Real-time performance metrics for candidate engagement blogs</p>
      </div>

      {/* Numerical Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="small-group-card p-6 bg-white flex items-center gap-4 border border-slate-200/60 rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#2563eb]/5 text-[#2563eb] flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Accumulated Views</p>
            <p className="text-2xl font-black text-[#090d16] mt-1 leading-none">{stats.views}</p>
          </div>
        </div>

        <div className="small-group-card p-6 bg-white flex items-center gap-4 border border-slate-200/60 rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Candidate Likes</p>
            <p className="text-2xl font-black text-[#090d16] mt-1 leading-none">{stats.likes}</p>
          </div>
        </div>

        <div className="small-group-card p-6 bg-white flex items-center gap-4 border border-slate-200/60 rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Average Read Duration</p>
            <p className="text-2xl font-black text-[#090d16] mt-1 leading-none">{stats.avgReadTime}</p>
          </div>
        </div>
      </div>

      {/* Graphical Chart section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline stage distribution chart */}
        <div className="small-group-card p-8 bg-white flex flex-col gap-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-black text-[#090d16] tracking-tight">Pipeline Stage Distribution</h3>
            <p className="text-xs text-slate-400 font-semibold">Relative density of blogs inside the pipeline</p>
          </div>

          <div className="space-y-5">
            {stats.pipelineStages.map((stage) => (
              <div key={stage.name} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: stage.color }}></span>
                    {stage.name}
                  </span>
                  <span className="text-slate-400 font-bold">
                    {stage.count} {stage.count === 1 ? 'post' : 'posts'} ({stage.percentage}%)
                  </span>
                </div>
                {/* Custom bar chart progress indicator */}
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      backgroundColor: stage.color,
                      width: `${stage.percentage}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High Performing recruitment blogs */}
        <div className="small-group-card p-8 bg-white flex flex-col gap-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-black text-[#090d16] tracking-tight">High Performing Recruitment Blogs</h3>
            <p className="text-xs text-slate-400 font-semibold">Leading talent funnel drivers by page views</p>
          </div>

          <div className="space-y-4">
            {stats.popularPosts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
                <p className="text-xs text-slate-400">No popular posts recorded yet.</p>
              </div>
            ) : (
              stats.popularPosts.map((post, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-100/80 hover:bg-slate-50/50 hover:border-slate-200 transition-all gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className="bg-[#2563eb]/5 text-[#2563eb] border border-[#2563eb]/10 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                      {post.role}
                    </span>
                    <h4 className="text-xs font-bold text-[#090d16] line-clamp-1 truncate leading-snug">
                      {post.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-black text-[#090d16] shrink-0">
                    <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500">
                      <Eye className="w-3.5 h-3.5 text-slate-400" /> {post.views}
                    </span>
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
