'use client'

import React, { useState } from 'react'
import { 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  User 
} from 'lucide-react'
import { cleanImageUrl } from '@/utils/cleanImageUrl'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string
  targetRole: string
  readTime: string
  views: number
  likes: number
  author?: {
    name: string
    avatar?: string
  }
  stage: {
    id: string
    name: string
    key: string
    color: string
  }
}

interface Stage {
  id: string
  name: string
  key: string
  color: string
}

interface KanbanBoardProps {
  initialPosts: Post[]
  stages: Stage[]
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ initialPosts, stages }) => {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  // Sort stages by standard recruitment progression
  const stageOrder = ['draft', 'review', 'approved', 'scheduled', 'published']
  const sortedStages = [...stages].sort(
    (a, b) => stageOrder.indexOf(a.key) - stageOrder.indexOf(b.key)
  )

  const handleMoveStage = async (postId: string, direction: 'prev' | 'next') => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return

    const currentIdx = stageOrder.indexOf(post.stage.key)
    const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1

    if (targetIdx < 0 || targetIdx >= stageOrder.length) return

    const targetStageKey = stageOrder[targetIdx]
    const targetStage = sortedStages.find((s) => s.key === targetStageKey)
    if (!targetStage) return

    // Optimistic UI update
    const previousPosts = [...posts]
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? { ...p, stage: { ...p.stage, ...targetStage } }
          : p
      )
    )
    setIsUpdating(postId)

    try {
      // Perform Payload REST API update
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: targetStage.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update stage in database')
      }
    } catch (err) {
      console.error('Error updating stage:', err)
      // Rollback on failure
      setPosts(previousPosts)
    } finally {
      setIsUpdating(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 text-left">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#090d16] tracking-tight">Editorial Lifecycle</h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">Move candidate-facing posts between stages dynamically</p>
        </div>
        <div className="inline-flex self-start items-center gap-1.5 px-3 py-1 bg-[#2563eb]/5 border border-[#2563eb]/10 rounded-full text-xs font-semibold text-[#2563eb] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Click arrows to shift stages</span>
        </div>
      </div>

      {/* Horizontally Scrollable Board Container */}
      <div className="flex gap-5 overflow-x-auto pb-6 items-start w-full min-h-[660px]">
        {sortedStages.map((stage) => {
          const stagePosts = posts.filter((p) => p.stage?.key === stage.key)
          
          return (
            <div 
              key={stage.id} 
              className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3.5 w-[280px] shrink-0 h-[600px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] transition-all duration-300"
            >
              {/* Column Title Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shadow-sm" 
                    style={{ backgroundColor: stage.color }}
                  ></span>
                  <h3 className="text-[10px] font-black text-slate-700 tracking-widest uppercase">
                    {stage.name}
                  </h3>
                </div>
                <span className="bg-white border border-slate-200 text-slate-500 font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                  {stagePosts.length}
                </span>
              </div>

              {/* Column Cards Scrollable Container */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 select-none scrollbar-none">
                {stagePosts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200/60 rounded-2xl text-slate-400 bg-white/40 p-4 transition-colors">
                    <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-400">Empty Stage</p>
                  </div>
                ) : (
                  stagePosts.map((post) => {
                    const currentIdx = stageOrder.indexOf(stage.key)
                    const canMovePrev = currentIdx > 0
                    const canMoveNext = currentIdx < stageOrder.length - 1

                    return (
                      <div 
                        key={post.id} 
                        className={`p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col gap-3.5 transition-all duration-300 relative group shrink-0 ${
                          isUpdating === post.id 
                            ? 'opacity-60 scale-[0.98]' 
                            : 'hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        {/* Target Role & Read Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-[#2563eb]/5 text-[#2563eb] border border-[#2563eb]/10 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                            {post.targetRole || 'General'}
                          </span>
                          <span className="text-[8px] font-extrabold text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-[#2563eb]" /> {post.readTime}
                          </span>
                        </div>

                        {/* Card Title */}
                        <h4 className="text-xs font-bold text-[#090d16] line-clamp-2 leading-relaxed tracking-tight group-hover:text-[#2563eb] transition-colors duration-200">
                          {post.title}
                        </h4>

                        {/* Divider */}
                        <div className="h-px bg-slate-100"></div>

                        {/* Card Footer: Author + Actions */}
                        <div className="flex items-center justify-between gap-3 mt-0.5">
                          {/* Author Widget */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {post.author?.avatar ? (
                              <img 
                                src={cleanImageUrl(post.author.avatar)} 
                                alt={post.author.name}
                                className="w-5 h-5 rounded-full object-cover border border-slate-200 shadow-inner"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
                                <User className="w-2.5 h-2.5" />
                              </div>
                            )}
                            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-[75px]">
                              {post.author?.name || 'System'}
                            </span>
                          </div>

                          {/* Quick Stage Controls */}
                          <div className="flex items-center gap-1 shrink-0 lg:opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0">
                            {canMovePrev && (
                              <button
                                onClick={() => handleMoveStage(post.id, 'prev')}
                                disabled={isUpdating !== null}
                                className="p-1 hover:bg-slate-100 hover:text-slate-700 text-slate-400 rounded-lg transition-all duration-200 cursor-pointer"
                                title="Move Stage Back"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canMoveNext && (
                              <button
                                onClick={() => handleMoveStage(post.id, 'next')}
                                disabled={isUpdating !== null}
                                className="p-1 hover:bg-[#2563eb]/5 hover:text-[#2563eb] text-[#2563eb] rounded-lg border border-[#2563eb]/10 bg-[#2563eb]/5 shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center"
                                title="Promote Stage"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
