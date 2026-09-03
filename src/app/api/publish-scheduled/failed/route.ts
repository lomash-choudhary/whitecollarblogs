/**
 * QStash failure callback.
 *
 * Called once every retry of a scheduled publish has been exhausted. Without
 * this the post would sit in the Scheduled stage looking fine while its
 * delivery quietly went to the dead letter queue. Upstash recommends a failure
 * callback over polling the DLQ on serverless, since there is no worker to poll
 * with.
 *
 * The post is left in the Scheduled stage on purpose: it records what went
 * wrong and lets a human decide, rather than publishing something whose
 * publish path is evidently broken.
 */
import { NextResponse } from 'next/server'
import { Receiver, SignatureError } from '@upstash/qstash'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { isDevMode, schedulerFailureUrl } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'

function receiver(): Receiver | null {
  if (isDevMode()) return new Receiver({ devMode: true })
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) return null
  return new Receiver({ currentSigningKey, nextSigningKey })
}

/** The original message body, which QStash returns base64 encoded. */
function decodeSourceBody(sourceBody?: string): { postId?: string } {
  if (!sourceBody) return {}
  try {
    return JSON.parse(Buffer.from(sourceBody, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  const verifier = receiver()
  if (!verifier) {
    return NextResponse.json({ error: 'Scheduling is not configured.' }, { status: 503 })
  }

  const signature = request.headers.get('Upstash-Signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 401 })
  }

  const raw = await request.text()

  try {
    const valid = await verifier.verify({
      signature,
      body: raw,
      url: schedulerFailureUrl(),
      clockTolerance: 5,
      // Tells the SDK which region's signing keys to use. Harmless on a
      // single-region setup, required once QSTASH_REGION is in play.
      upstashRegion: request.headers.get('Upstash-Region') ?? undefined,
    })
    if (!valid) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  } catch (err: unknown) {
    if (!(err instanceof SignatureError)) {
      console.error(`[schedule] failure-callback verification error: ${err}`)
    }
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let payloadBody: { status?: number; sourceBody?: string; dlqId?: string; retried?: number } = {}
  try {
    payloadBody = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, reason: 'Unreadable payload.' }, { status: 200 })
  }

  const { postId } = decodeSourceBody(payloadBody.sourceBody)
  if (!postId) {
    return NextResponse.json({ ok: false, reason: 'No postId in the payload.' }, { status: 200 })
  }

  const reason = [
    `Automatic publish failed after ${payloadBody.retried ?? 'all'} attempts`,
    payloadBody.status ? `(HTTP ${payloadBody.status})` : '',
    payloadBody.dlqId ? `— DLQ id ${payloadBody.dlqId}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'posts',
      id: postId,
      data: {
        scheduleStatus: 'failed',
        scheduleMessage: `${reason}. The post was left scheduled — publish it by hand or pick a new time.`,
        scheduleMessageId: null,
      },
      overrideAccess: true,
      depth: 0,
      // Clearing the message id must not look like an unschedule and start
      // cancelling things; this is only a status write.
      context: { skipScheduleSync: true },
    })
    payload.logger.error(`[schedule] ${reason} for post ${postId}`)
  } catch (err: unknown) {
    console.error(`[schedule] could not record the failure for ${postId}: ${err}`)
  }

  // Always acknowledge: the failure notice itself is a QStash message, and
  // retrying it would achieve nothing.
  return NextResponse.json({ ok: true, postId }, { status: 200 })
}
