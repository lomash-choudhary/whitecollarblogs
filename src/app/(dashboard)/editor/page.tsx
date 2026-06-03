import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { BlogEditor } from '@/components/BlogEditor'


interface PageProps {
  searchParams: Promise<{
    id?: string
  }>
}

export default async function EditorPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const postId = resolvedSearchParams.id

  let authors: any[] = []
  let stages: any[] = []
  let initialPost: any = null

  try {
    const payload = await getPayload({ config })
    
    // Fetch Authors
    const authorsResult = await payload.find({
      collection: 'authors',
      limit: 100,
    })
    authors = authorsResult.docs.map((author: any) => ({
      id: author.id,
      name: author.name,
      role: author.role || 'Contributor',
    }))

    // Fetch Stages with dynamic self-healing initialization
    const { ensurePipelineStages } = await import('@/utils/ensureStages')
    const stagesDocs = await ensurePipelineStages(payload)
    const STAGE_ORDER = ['draft', 'review', 'approved', 'scheduled', 'published']
    stages = stagesDocs
      .map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        key: stage.key,
      }))
      .sort((a: any, b: any) => STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key))

    // Fetch existing post if editing
    if (postId) {
      try {
        const postDoc = await payload.findByID({
          collection: 'posts',
          id: postId,
          depth: 0,
        })
        if (postDoc) {
          initialPost = {
            id: postDoc.id,
            title: postDoc.title,
            slug: postDoc.slug,
            excerpt: postDoc.excerpt || '',
            content: postDoc.content,
            targetRole: postDoc.targetRole || 'Software Engineer',
            readTime: postDoc.readTime || '3 min read',
            author: typeof postDoc.author === 'object' && postDoc.author !== null ? (postDoc.author as any).id : postDoc.author,
            stage: typeof postDoc.stage === 'object' && postDoc.stage !== null ? (postDoc.stage as any).id : postDoc.stage,
            coverImageUrl: postDoc.coverImageUrl || '',
            coverImage: typeof postDoc.coverImage === 'object' && postDoc.coverImage !== null ? (postDoc.coverImage as any).id : postDoc.coverImage,
          }
        }
      } catch (err) {
        console.error(`Failed to fetch post by ID: ${postId}`, err)
      }
    }
  } catch (err) {
    console.error('Error fetching CMS authors and stages:', err)
    authors = []
    stages = []
  }

  return (
    <div className="w-full">
      <BlogEditor authors={authors} stages={stages} initialPost={initialPost} />
    </div>
  )
}
