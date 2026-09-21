import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { KanbanBoard } from '@/components/KanbanBoard'
import { getActiveSite } from '@/utils/activeSite'
import { findSitePosts } from '@/utils/sitePosts'


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

    // Fetch posts. No page limit: the board and the overview count the same
    // rows, so a cap here would make the two screens disagree.
    const siteDocs = await findSitePosts(payload, activeSite.key)
    const fallbackStage =
      stages.find((stage: any) => stage.key === 'draft') ?? stages[0] ?? null

    posts = siteDocs
      .map((post: any) => {
        // A post whose stage relation did not populate is placed in Draft
        // rather than dropped — a row the overview counts and the board hides
        // is exactly the mismatch this page is being kept in step with.
        const populated = post.stage && typeof post.stage === 'object' ? post.stage : null
        const stage = populated
          ? {
              id: populated.id,
              name: populated.name,
              key: populated.key,
              color: populated.color,
            }
          : fallbackStage

        if (!stage) return null

        return {
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
          stage,
        }
      })
      .filter(Boolean)
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
