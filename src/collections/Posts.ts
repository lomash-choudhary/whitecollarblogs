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
        // Guard against the recursive update we do below to store the result.
        if (context?.skipExternalPublish) return doc

        const site = getSite((doc as any).site)
        if (site.target !== 'github') return doc

        // A view/like counter bump must not re-publish the article. Only send
        // it again when something that actually appears on the site changed.
        if (operation === 'update' && previousDoc && !hasPublishableChange(doc, previousDoc)) {
          return doc
        }

        // Resolve the stage relationship to its key (it may be an id or a doc).
        let stageKey: string | undefined
        const stage = (doc as any).stage
        if (stage && typeof stage === 'object') {
          stageKey = stage.key
        } else if (stage) {
          try {
            // `req` keeps these reads on the request's own transaction and
            // connection instead of competing for the small pool.
            const stageDoc = await req.payload.findByID({
              collection: 'pipeline-stages',
              id: stage,
              req,
            })
            stageKey = (stageDoc as any)?.key
          } catch {
            stageKey = undefined
          }
        }

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
