/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionConfig } from 'payload'
import { DEFAULT_SITE_KEY, getSite, isKnownSite, SITES } from '../config/sites'

/** Fields whose value ends up in the generated markdown file. */
const PUBLISHABLE_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'content',
  'coverImage',
  'coverImageUrl',
  'readTime',
  'targetRole',
  'author',
  'stage',
  'publishDate',
  'site',
] as const

function relationId(value: unknown): unknown {
  return value && typeof value === 'object' ? (value as { id?: unknown }).id : value
}

function hasPublishableChange(doc: any, previousDoc: any): boolean {
  return PUBLISHABLE_FIELDS.some((field) => {
    const next = field === 'author' || field === 'stage' ? relationId(doc?.[field]) : doc?.[field]
    const prev =
      field === 'author' || field === 'stage' ? relationId(previousDoc?.[field]) : previousDoc?.[field]
    return JSON.stringify(next ?? null) !== JSON.stringify(prev ?? null)
  })
}

/** Resolves a stage relationship (id or populated doc) to its key. */
async function resolveStageKey(stage: unknown, req: any): Promise<string | undefined> {
  if (!stage) return undefined
  if (typeof stage === 'object') return (stage as { key?: string }).key
  try {
    // `req` keeps this read on the request's own transaction and connection
    // instead of competing for the small pool.
    const stageDoc = await req.payload.findByID({
      collection: 'pipeline-stages',
      id: stage as string,
      req,
    })
    return (stageDoc as { key?: string })?.key
  } catch {
    return undefined
  }
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'stage', 'publishDate'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: false,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      // Plain URL fallback for environments where filesystem uploads aren't available
      // (e.g. Vercel serverless). The blog listing prefers coverImageUrl over coverImage.
      name: 'coverImageUrl',
      type: 'text',
      required: false,
      admin: {
        placeholder: 'https://images.unsplash.com/...',
        description: 'Paste an image URL (used instead of file upload on Vercel)',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      required: true,
    },
    {
      name: 'stage',
      type: 'relationship',
      relationTo: 'pipeline-stages',
      required: true,
    },
    {
      name: 'publishDate',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'readTime',
      type: 'text',
      required: false,
      defaultValue: '5 min read',
    },
    {
      name: 'targetRole',
      type: 'text',
      required: false,
      admin: {
        placeholder: 'e.g. Software Engineer',
      },
    },
    {
      name: 'views',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'likes',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      // Which website this post belongs to. 'wcb' = this CMS renders it.
      // Anything else is pushed out to that website's GitHub repo on publish.
      // Stored as plain text (not a select) so no Postgres enum migration is needed.
      name: 'site',
      type: 'text',
      required: false,
      defaultValue: DEFAULT_SITE_KEY,
      index: true,
      admin: {
        position: 'sidebar',
        description: `Target website key. One of: ${SITES.map((s) => s.key).join(', ')}`,
      },
    },
    {
      name: 'externalStatus',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'idle | dispatched | failed',
      },
    },
    {
      name: 'externalMessage',
      type: 'textarea',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'externalUrl',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastDispatchedAt',
      type: 'date',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      // When a post in the "Scheduled" stage should go live. Stored in UTC.
      name: 'scheduledFor',
      type: 'date',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'When a scheduled post should publish itself (UTC).',
      },
    },
    {
      // QStash message id for the pending publish, so it can be cancelled or
      // replaced when the schedule moves.
      name: 'scheduleMessageId',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'scheduleStatus',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'idle | scheduled | cancelled | failed | published',
      },
    },
    {
      name: 'scheduleMessage',
      type: 'textarea',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (!isKnownSite(data.site)) data.site = DEFAULT_SITE_KEY
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context, operation }) => {
        // Skip the bookkeeping update this hook makes about itself.
        if (context?.skipScheduleSync) return doc

        const post = doc as any
        const stageKey = await resolveStageKey(post.stage, req)
        const wantsSchedule = stageKey === 'scheduled' && Boolean(post.scheduledFor)

        // The common case by far — an ordinary save of a post that has nothing
        // to do with scheduling. Leave before spending another query on it.
        if (!wantsSchedule && !post.scheduleMessageId) return doc

        const previousStageKey =
          operation === 'update' && previousDoc
            ? await resolveStageKey((previousDoc as any).stage, req)
            : undefined
        const scheduleUnchanged =
          previousStageKey === 'scheduled' &&
          String((previousDoc as any)?.scheduledFor ?? '') === String(post.scheduledFor ?? '') &&
          Boolean(post.scheduleMessageId)

        // Still queued for the same moment, so the existing message stands.
        if (wantsSchedule && scheduleUnchanged) return doc

        const { schedulePublish, cancelScheduledPublish } = await import('../lib/scheduler')

        // Any pending delivery is now stale, whether we are rescheduling or
        // unscheduling. Drop it before queueing anything new.
        const cancelled = await cancelScheduledPublish(post.scheduleMessageId)

        let data: Record<string, unknown>
        if (wantsSchedule) {
          const result = await schedulePublish(post.id, new Date(post.scheduledFor))
          data = {
            scheduleMessageId: result.messageId ?? null,
            scheduleStatus: result.status === 'scheduled' ? 'scheduled' : 'failed',
            scheduleMessage: result.message,
          }
          req.payload.logger.info(
            `[schedule] "${post.slug}" -> ${result.status}: ${result.message}`,
          )
        } else {
          data = {
            scheduleMessageId: null,
            scheduleStatus: cancelled.ok ? 'cancelled' : 'failed',
            scheduleMessage: cancelled.message,
          }
          req.payload.logger.info(`[schedule] "${post.slug}" unscheduled: ${cancelled.message}`)
        }

        try {
          await req.payload.update({
            collection: 'posts',
            id: post.id,
            data,
            // Same transaction as the save that triggered this, otherwise a
            // second connection deadlocks on the row lock already held here.
            req,
            context: { ...(context ?? {}), skipScheduleSync: true },
            depth: 0,
          })
        } catch (err) {
          req.payload.logger.error(`[schedule] could not record schedule state: ${err}`)
        }

        return doc
      },
      async ({ doc, previousDoc, req, context, operation }) => {
        // Guard against the recursive update we do below to store the result.
        if (context?.skipExternalPublish) return doc

        const site = getSite((doc as any).site)
        if (site.target !== 'github') return doc

        // A view/like counter bump must not re-publish the article. Only send
        // it again when something that actually appears on the site changed.
        if (operation === 'update' && previousDoc && !hasPublishableChange(doc, previousDoc)) {
          return doc
        }

        const stageKey = await resolveStageKey((doc as any).stage, req)
        if (stageKey !== 'published') return doc

        // Author is needed for the byline in the generated markdown.
        let author = (doc as any).author
        if (author && typeof author !== 'object') {
          try {
            author = await req.payload.findByID({ collection: 'authors', id: author, req })
          } catch {
            author = undefined
          }
        }

        // Mark the request before doing any work: the status write below goes
        // through the same collection and must not run this hook again.
        if (req.context) (req.context as Record<string, unknown>).skipExternalPublish = true

        const { publishPostToSite } = await import('../lib/publishToSite')
        const result = await publishPostToSite(doc, author)

        req.payload.logger.info(
          `[multi-site] ${operation} "${(doc as any).slug}" -> ${site.key}: ${result.status} — ${result.message}`,
        )

        try {
          await req.payload.update({
            collection: 'posts',
            id: (doc as any).id,
            data: {
              externalStatus: result.status,
              externalMessage: result.message,
              externalUrl: result.liveUrl || '',
              lastDispatchedAt: new Date().toISOString(),
            },
            // Reusing `req` keeps this write inside the transaction that is
            // already holding a lock on this row — a fresh connection would
            // block on that lock until the pool times out.
            req,
            context: { skipExternalPublish: true },
            depth: 0,
          })
        } catch (err) {
          req.payload.logger.error(`[multi-site] could not record publish status: ${err}`)
        }

        return doc
      },
    ],
  },
}
