import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { KanbanBoard } from '@/components/KanbanBoard'
import { getActiveSite, siteWhere } from '@/utils/activeSite'


export default async function KanbanPage() {
  const activeSite = await getActiveSite()
  let posts: any[] = []
  let stages: any[] = []

  try {
    const payload = await getPayload({ config })
    
    // Fetch stages first with dynamic self-healing initialization
    const { ensurePipelineStages } = await import('@/utils/ensureStages')
    const stagesDocs = await ensurePipelineStages(payload)
    stages = stagesDocs.map((stage: any) => ({
      id: stage.id,
      name: stage.name,
      key: stage.key,
      color: stage.color,
    }))

    // Fetch posts
    const postsResult = await payload.find({
      collection: 'posts',
      where: siteWhere(activeSite.key),
      limit: 100,
      depth: 1,
    })
    posts = postsResult.docs
      .filter((post: any) => post.stage && typeof post.stage === 'object')
      .map((post: any) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        targetRole: post.targetRole || 'Generic',
        readTime: post.readTime || '5 min read',
        views: post.views || 0,
        likes: post.likes || 0,
        author: post.author ? {
          name: post.author.name,
          avatar: post.author.avatar || undefined,
        } : undefined,
        stage: {
          id: post.stage.id,
          name: post.stage.name,
          key: post.stage.key,
          color: post.stage.color,
        },
      }))
  } catch (err) {
    console.error('Error loading Kanban data from Payload CMS:', err)
    stages = []
    posts = []
  }

  return (
    <div className="w-full">
      <KanbanBoard initialPosts={posts} stages={stages} />
    </div>
  )
}
