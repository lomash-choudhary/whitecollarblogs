/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Manual re-publish endpoint.
 *
 * Publishing normally happens automatically when a post reaches the
 * "Published" stage. This route exists so a failed dispatch (expired token,
 * GitHub outage) can be retried from the dashboard without editing the post.
 *
 *   POST /api/publish-external  { "postId": "123" }
 */
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { publishPostToSite } from '@/lib/publishToSite'
import { getSite } from '@/config/sites'

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const postId = body?.postId
    if (!postId) {
      return NextResponse.json({ error: 'postId is required.' }, { status: 400 })
    }

    const post: any = await payload.findByID({ collection: 'posts', id: postId, depth: 1 })
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
    }

    const site = getSite(post.site)
    if (site.target !== 'github') {
      return NextResponse.json(
        { error: `"${site.name}" is served by this CMS — there is nothing to push.` },
        { status: 400 },
      )
    }

    const stageKey = typeof post.stage === 'object' ? post.stage?.key : undefined
    if (stageKey !== 'published') {
      return NextResponse.json(
        { error: 'Only posts in the Published stage can be sent to an external website.' },
        { status: 400 },
      )
    }

    const author = typeof post.author === 'object' ? post.author : undefined
    const result = await publishPostToSite(post, author)

    await payload.update({
      collection: 'posts',
      id: postId,
      data: {
        externalStatus: result.status,
        externalMessage: result.message,
        externalUrl: result.liveUrl || '',
        lastDispatchedAt: new Date().toISOString(),
      },
      context: { skipExternalPublish: true },
      depth: 0,
    })

    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
  }
}
