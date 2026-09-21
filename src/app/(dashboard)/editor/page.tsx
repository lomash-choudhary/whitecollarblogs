/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { BlogEditor } from '@/components/BlogEditor'


interface PageProps {
  searchParams: Promise<{
    id?: string
    upload?: string
  }>
}

export default async function EditorPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const postId = resolvedSearchParams.id
  // `New Blog` asks for the upload dialog by carrying `?upload=1`; a plain
  // `/editor` is the same blank editor it always was. Never while editing —
  // the dialog replaces the whole body.
  const startWithUpload = !postId && resolvedSearchParams.upload === '1'

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
          // Multi-site and scheduling columns are not in the generated types.
          const extra = postDoc as any
          initialPost = {
            id: postDoc.id,
            title: postDoc.title,
            slug: postDoc.slug,
            excerpt: postDoc.excerpt || '',
            // The SEO box. Read off `extra` like the other columns Payload's
            // generated types do not know about yet.
            metaTitle: extra.metaTitle || '',
            metaDescription: extra.metaDescription || '',
            metaKeywords: extra.metaKeywords || '',
            canonicalUrl: extra.canonicalUrl || '',
            coverImageAlt: extra.coverImageAlt || '',
            ogImageUrl: extra.ogImageUrl || '',
            targetKeyword: extra.targetKeyword || '',
            content: postDoc.content,
            targetRole: postDoc.targetRole || 'Software Engineer',
            readTime: postDoc.readTime || '3 min read',
            author: typeof postDoc.author === 'object' && postDoc.author !== null ? (postDoc.author as any).id : postDoc.author,
            stage: typeof postDoc.stage === 'object' && postDoc.stage !== null ? (postDoc.stage as any).id : postDoc.stage,
            coverImageUrl: postDoc.coverImageUrl || '',
            coverImage: typeof postDoc.coverImage === 'object' && postDoc.coverImage !== null ? (postDoc.coverImage as any).id : postDoc.coverImage,
            site: extra.site || undefined,
            externalStatus: extra.externalStatus || undefined,
            externalMessage: extra.externalMessage || undefined,
            externalUrl: extra.externalUrl || undefined,
            scheduledFor: extra.scheduledFor || undefined,
            scheduleStatus: extra.scheduleStatus || undefined,
            scheduleMessage: extra.scheduleMessage || undefined,
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
      <BlogEditor
        authors={authors}
        stages={stages}
        initialPost={initialPost}
        startWithUpload={startWithUpload}
      />
    </div>
  )
}
