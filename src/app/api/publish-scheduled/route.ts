/**
 * Webhook QStash calls when a scheduled post is due.
 *
 * This endpoint is public, so every request must prove it came from QStash
 * before it can publish anything. It is also idempotent: QStash retries on any
 * non-2xx response, so running twice must be harmless, and a post that no
 * longer wants publishing returns 200 to stop the retries rather than failing
 * forever.
 */
import { NextResponse } from 'next/server'
import { Receiver, SignatureError } from '@upstash/qstash'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { isDevMode, schedulerCallbackUrl } from '@/lib/scheduler'

// Publishing can involve a GitHub dispatch, so give it room beyond the default.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function receiver(): Receiver | null {
  // The dev server signs with its own deterministic keys, which the SDK knows.
  if (isDevMode()) return new Receiver({ devMode: true })

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) return null
  return new Receiver({ currentSigningKey, nextSigningKey })
}

export async function POST(request: Request) {
  // Verification is not optional. Without keys configured the endpoint refuses
  // to act rather than falling back to trusting the caller.
  const verifier = receiver()
  if (!verifier) {
    console.error('[schedule] QSTASH signing keys are not configured; refusing the request.')
    return NextResponse.json({ error: 'Scheduling is not configured.' }, { status: 503 })
  }

  const signature = request.headers.get('Upstash-Signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 401 })
  }

  // The raw body is what was signed — parsing first would break verification.
  const raw = await request.text()

  try {
    const valid = await verifier.verify({
      signature,
      body: raw,
      // Pins the signature to this exact endpoint, so a signature captured for
      // one route cannot be replayed against another.
      url: schedulerCallbackUrl(),
      // Signatures expire after five minutes; a little slack absorbs ordinary
      // clock drift between QStash and the serverless host.
      clockTolerance: 5,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }
  } catch (err: unknown) {
    if (err instanceof SignatureError) {
      console.error(`[schedule] rejected an unsigned or forged request: ${err.message}`)
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }
    const detail = err instanceof Error ? err.message : 'unknown error'
    console.error(`[schedule] signature verification failed: ${detail}`)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let postId: string | undefined
  try {
    postId = JSON.parse(raw)?.postId
  } catch {
    postId = undefined
  }
  if (!postId) {
    // Malformed and unfixable by retrying, so accept it and stop.
    return NextResponse.json({ ok: false, reason: 'No postId in the payload.' }, { status: 200 })
  }

  try {
    const payload = await getPayload({ config })

    const post = await payload
      .findByID({ collection: 'posts', id: postId, depth: 1, overrideAccess: true })
      .catch(() => null)

    if (!post) {
      return NextResponse.json({ ok: false, reason: 'Post no longer exists.' }, { status: 200 })
    }

    const stageKey =
      typeof (post as { stage?: unknown }).stage === 'object'
        ? ((post as { stage?: { key?: string } }).stage?.key ?? null)
        : null

    // Someone may have published, unscheduled or reverted the post since. Any
    // of those means this delivery is stale — acknowledge it and stop retrying.
    if (stageKey !== 'scheduled') {
      return NextResponse.json(
        { ok: false, reason: `Post is in the "${stageKey}" stage, not "scheduled".` },
        { status: 200 },
      )
    }

    const stages = await payload.find({
      collection: 'pipeline-stages',
      where: { key: { equals: 'published' } },
      limit: 1,
      overrideAccess: true,
    })
    const publishedStage = stages.docs[0]
    if (!publishedStage) {
      // A missing stage is a server problem, so let QStash retry.
      return NextResponse.json({ error: 'No "published" stage exists.' }, { status: 500 })
    }

    // Moving the stage is all it takes: the collection's afterChange hook does
    // the rest, including pushing to another website when the post targets one.
    await payload.update({
      collection: 'posts',
      id: postId,
      data: {
        stage: publishedStage.id,
        publishDate: new Date().toISOString(),
        scheduleStatus: 'published',
        scheduleMessage: `Published automatically on ${new Date().toUTCString()}.`,
        scheduleMessageId: null,
      },
      overrideAccess: true,
      depth: 0,
    })

    payload.logger.info(`[schedule] published post ${postId} on time`)
    return NextResponse.json({ ok: true, postId }, { status: 200 })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    console.error(`[schedule] failed to publish ${postId}: ${detail}`)
    // A real failure — let QStash retry.
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
