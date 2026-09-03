/**
 * Scheduled publishing via Upstash QStash.
 *
 * Vercel has no long-running process, so "publish this at 4pm" cannot be a
 * timer held in memory. Instead we hand QStash a message with an absolute
 * delivery time; at that moment QStash calls our webhook, which flips the post
 * to Published. From there the normal publish path takes over — including the
 * GitHub dispatch for posts that belong to another website.
 *
 * One message per scheduled post. Moving the date cancels the old message and
 * publishes a new one, so a post never has two pending deliveries.
 */

import { Client } from '@upstash/qstash'

/**
 * QStash ships a local dev server so scheduling can be exercised without a
 * public tunnel or real credentials. Leaving `devMode` unset lets the SDK read
 * QSTASH_DEV itself, but the checks below need to know too — in dev mode there
 * is no real token and localhost is exactly the right callback.
 */
export function isDevMode(): boolean {
  const flag = process.env.QSTASH_DEV
  return flag === 'true' || flag === '1'
}

function baseUrl(): string {
  return (process.env.QSTASH_CALLBACK_URL || process.env.NEXT_PUBLIC_SERVER_URL || '')
    .trim()
    .replace(/\/$/, '')
}

/** Where QStash calls back when a scheduled post is due. */
export function schedulerCallbackUrl(): string {
  return `${baseUrl()}/api/publish-scheduled`
}

/** Where QStash reports a delivery that failed every retry. */
export function schedulerFailureUrl(): string {
  return `${baseUrl()}/api/publish-scheduled/failed`
}

export function isSchedulerConfigured(): boolean {
  if (!schedulerCallbackUrl().startsWith('http')) return false
  return isDevMode() || Boolean(process.env.QSTASH_TOKEN)
}

let client: Client | null = null

function qstash(): Client {
  if (!client) {
    // In dev mode the SDK supplies its own token and base URL, and warns if we
    // pass one anyway, so only hand it a token for the real service.
    client = isDevMode() ? new Client({}) : new Client({ token: process.env.QSTASH_TOKEN as string })
  }
  return client
}

export interface ScheduleResult {
  ok: boolean
  status: 'scheduled' | 'cancelled' | 'skipped' | 'failed'
  message: string
  messageId?: string
}

/**
 * Cancels a pending delivery. Safe to call with an id QStash has already
 * delivered or forgotten — that is treated as success, because the desired end
 * state (no pending message) is what we got.
 */
export async function cancelScheduledPublish(messageId?: string | null): Promise<ScheduleResult> {
  if (!messageId) {
    return { ok: true, status: 'skipped', message: 'Nothing was scheduled.' }
  }
  if (!isSchedulerConfigured()) {
    return { ok: false, status: 'failed', message: 'QStash is not configured.' }
  }

  try {
    await qstash().messages.cancel(messageId)
    return { ok: true, status: 'cancelled', message: 'Scheduled publish cancelled.' }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    // A message that already fired cannot be cancelled, and does not need to be.
    if (/not found|404/i.test(detail)) {
      return { ok: true, status: 'skipped', message: 'That schedule had already run.' }
    }
    return { ok: false, status: 'failed', message: `Could not cancel the schedule: ${detail}` }
  }
}

/**
 * Queues a post to publish itself at `scheduledFor`.
 *
 * A time in the past is delivered immediately rather than rejected — the writer
 * asked for it to be out by then, so the closest we can honour is "now".
 */
export async function schedulePublish(
  postId: string | number,
  scheduledFor: Date,
): Promise<ScheduleResult> {
  if (!isDevMode() && !process.env.QSTASH_TOKEN) {
    return { ok: false, status: 'failed', message: 'QSTASH_TOKEN is not set.' }
  }

  const url = schedulerCallbackUrl()
  if (!url.startsWith('http')) {
    return {
      ok: false,
      status: 'failed',
      message: 'No callback URL. Set QSTASH_CALLBACK_URL or NEXT_PUBLIC_SERVER_URL.',
    }
  }
  // The hosted service has to reach us over the internet. The dev server runs
  // on this machine, so there localhost is not just allowed but expected.
  if (!isDevMode() && /localhost|127\.0\.0\.1/.test(url)) {
    return {
      ok: false,
      status: 'failed',
      message: `QStash cannot reach ${url}. Run the dev server with QSTASH_DEV=true, or point QSTASH_CALLBACK_URL at a public tunnel.`,
    }
  }

  // The API takes whole seconds, and a time already past means "send now".
  const notBefore = Math.max(Math.ceil(scheduledFor.getTime() / 1000), Math.ceil(Date.now() / 1000))

  try {
    const res = await qstash().publishJSON({
      url,
      body: { postId: String(postId), scheduledFor: scheduledFor.toISOString() },
      notBefore,
      // The webhook is idempotent, so retries are safe and worth having.
      retries: 3,
      // Publishing can involve a call out to GitHub; don't let QStash give up
      // on the request before our own handler would.
      timeout: 30,
      // When every retry has failed, QStash tells us instead of the post
      // silently sitting in "Scheduled" for ever.
      failureCallback: schedulerFailureUrl(),
      // Deliberately no deduplicationId. QStash remembers one for 90 days, so
      // rescheduling a post back onto a time it previously held would be
      // accepted and silently never delivered. Double-queueing is already
      // prevented by cancelling the old message before publishing a new one.
    })

    return {
      ok: true,
      status: 'scheduled',
      message: `Publishing automatically on ${scheduledFor.toUTCString()}.`,
      messageId: res.messageId,
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, status: 'failed', message: `Could not schedule the publish: ${detail}` }
  }
}
