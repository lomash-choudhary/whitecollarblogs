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
  // The SEO box. A meta tag only reaches a site through a re-publish, so
  // editing one has to count as a publishable change — otherwise a corrected
  // meta description saves, reports success, and never leaves the CMS.
  'metaTitle',
  'metaDescription',
  'metaKeywords',
  'canonicalUrl',
  'coverImageAlt',
  'ogImageUrl',
  'targetKeyword',
] as const

/** Of those, the ones stored as a relationship, which may arrive populated. */
const RELATIONSHIP_FIELDS = new Set<string>(['author', 'stage'])

function relationId(value: unknown): unknown {
  return value && typeof value === 'object' ? (value as { id?: unknown }).id : value
}

/** Comparable value of one field, so a populated relation matches its own id. */
function publishableValue(doc: any, field: string): unknown {
  const value = doc?.[field]
  return RELATIONSHIP_FIELDS.has(field) ? relationId(value) : value
}

function hasPublishableChange(doc: any, previousDoc: any): boolean {
  return PUBLISHABLE_FIELDS.some((field) => {
    const next = publishableValue(doc, field)
    const previous = publishableValue(previousDoc, field)
    return JSON.stringify(next ?? null) !== JSON.stringify(previous ?? null)
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
  /**
   * A slug is unique **per website**, not across the whole CMS.
   *
   * Each site publishes into its own repo and serves the article from its own
   * domain, so `signs-of-stucco-problems` on Durahome and the same slug on OVO
   * are two different URLs and neither shadows the other. This app itself no
   * longer serves articles at all (its `/resources` blog was removed on
   * 2026-09-20), so nothing here has to resolve a slug to a single post.
   *
   * `push` is false, so Payload never creates this index itself — the matching
   * statement in `scripts/upgrade-db-multisite.mjs` is what actually enforces
   * it, and the two have to be added in the same pass. Declaring it here is
   * still not decoration: it is where the rule is written down, and the schema
   * Payload builds from the config has to agree with the database.
   */
  indexes: [{ fields: ['site', 'slug'], unique: true }],
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
      // Indexed but **not** `unique`. A slug is only a URL within one website,
      // and every site publishes to its own repo — so the same article can
      // legitimately run on two of them, and until this changed the second one
      // was rejected as a duplicate of a post the writer could not even see
      // from the site they were working in. The uniqueness that does apply is
      // the compound index below.
      //
      // The plain index stays because the compound one is `(site, slug)` and
      // cannot serve a lookup by slug alone, which is what the public article
      // page does on every request.
      index: true,
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
    /**
     * Everything a published article's meta tags are built from.
     *
     * A `collapsible` is presentational — its children are ordinary top-level
     * fields and get ordinary top-level columns (`meta_title`, ...), so this
     * groups the box in the admin panel without nesting anything in Postgres.
     *
     * Every one of these is optional and falls back (see `resolveArticleSeo`
     * in src/lib/articleSeo.ts). A writer who fills in nothing gets the same
     * tags they get today; a writer who fills one in controls that tag on
     * whichever of the four sites the post is published to.
     */
    {
      type: 'collapsible',
      label: 'SEO & meta tags',
      admin: {
        initCollapsed: true,
        description:
          'Drives <title>, description, keywords, canonical, robots, the Open Graph tags and the Twitter card on every site. Leave a box empty to fall back to the title or excerpt.',
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          required: false,
          admin: {
            description:
              '<title>, og:title and twitter:title. The site name is appended to <title> automatically — do not type it. Falls back to the article title.',
            placeholder: 'Cost to Paint Kitchen Cabinets in 2026',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          required: false,
          admin: {
            description:
              'meta description, og:description and twitter:description. Falls back to the excerpt. Search engines cut it off around 160 characters.',
          },
        },
        {
          name: 'metaKeywords',
          type: 'text',
          required: false,
          admin: {
            description:
              'meta keywords, comma separated. Leave empty and the site falls back to its own site-wide keywords rather than publishing an empty tag.',
            placeholder: 'cabinet painting, kitchen cabinets, cost',
          },
        },
        {
          name: 'canonicalUrl',
          type: 'text',
          required: false,
          admin: {
            description:
              'Overrides <link rel="canonical"> and og:url. Leave empty — the site builds its own from the slug, which is right unless this article also lives somewhere else.',
            placeholder: 'https://www.ovopainting.com/resources/paint-sheen-guide',
          },
        },
        {
          name: 'coverImageAlt',
          type: 'text',
          required: false,
          admin: {
            description:
              'Alt text for the cover image, and the fallback for og:image:alt. Falls back to the meta title, which describes the article rather than the picture.',
          },
        },
        {
          name: 'ogImageUrl',
          type: 'text',
          required: false,
          admin: {
            description:
              'og:image and twitter:image. Only fill this in when the share card should differ from the cover image.',
            placeholder: 'https://…supabase.co/…/share-card.jpg',
          },
        },
        {
          name: 'targetKeyword',
          type: 'text',
          required: false,
          admin: {
            description:
              'The phrase this article is written to rank for. Not published as a meta tag — it travels with the article so each site can use it in its own copy.',
          },
        },
      ],
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

        const post = doc as any
        const site = getSite(post.site)
        if (site.target !== 'github') return doc

        // A view/like counter bump must not re-publish the article. Only send
        // it again when something that actually appears on the site changed.
        if (operation === 'update' && previousDoc && !hasPublishableChange(doc, previousDoc)) {
          return doc
        }

        const stageKey = await resolveStageKey(post.stage, req)
        if (stageKey !== 'published') return doc

        // Author is needed for the byline in the generated markdown.
        let author = post.author
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
        const result = await publishPostToSite(post, author)

        req.payload.logger.info(
          `[multi-site] ${operation} "${post.slug}" -> ${site.key}: ${result.status} — ${result.message}`,
        )

        try {
          await req.payload.update({
            collection: 'posts',
            id: post.id,
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
