/**
 * Turns a Payload REST error body into a sentence a writer can act on.
 *
 * Payload answers a rejected save with a top-level message built from field
 * *names* only — `"The following field is invalid: slug"` — and puts the reason
 * one level down, in `errors[0].data.errors[]`. Surfacing only the top level
 * (which every caller here used to do) tells a writer which box is wrong and
 * never why, so a duplicate slug and an empty slug read identically and neither
 * says what to type instead.
 *
 * The shape is fixed by `formatErrors` + `ValidationError` in payload 3.x:
 *
 *   { errors: [ { name: 'ValidationError',
 *                 message: 'The following field is invalid: slug',
 *                 data: { collection: 'posts',
 *                         errors: [ { path: 'slug',
 *                                     message: 'Value must be unique' } ] } } ] }
 *
 * `path` and `data.errors` are both optional in practice — an `APIError` thrown
 * by a hook carries a bare `message` and no `data` at all — so every level is
 * read defensively and the caller's fallback is what survives.
 */

/** One field-level failure out of `errors[0].data.errors`. */
interface FieldError {
  path?: string
  message?: string
}

/** One entry of the top-level `errors` array, as `formatErrors` writes it. */
interface PayloadError {
  message?: string
  data?: { errors?: FieldError[] }
}

/**
 * Field names as a writer sees them on the form, not as Postgres spells them.
 * An unlisted field falls back to its own path, which is still better than the
 * bare "invalid" it replaces.
 */
const FIELD_LABELS: Record<string, string> = {
  title: 'article title',
  slug: 'URL slug',
  excerpt: 'excerpt',
  content: 'article body',
  author: 'author',
  stage: 'pipeline stage',
  publishDate: 'publish date',
  scheduledFor: 'scheduled time',
  readTime: 'read time',
  targetRole: 'target focus / category',
  coverImageUrl: 'cover image URL',
  site: 'website',
}

/** Postgres reports a unique violation through this exact wording. */
const UNIQUE = /must be unique/i
const REQUIRED = /required|cannot be (blank|empty)/i

/**
 * A compound unique index reports every column it covers, not one field.
 *
 * `(site, slug)` is enforced by the database rather than by a Payload `unique`
 * flag, so a violation arrives as a raw Postgres 23505 that the adapter turns
 * into a `ValidationError` whose `path` it reads out of the error detail —
 * `Key (site, slug)=(durahome, signs-of-stucco-problems) already exists.`
 * gives the literal path `"site, slug"`. Split back apart, the slug is the
 * half a writer can do something about.
 */
function pathParts(path: string | undefined): string[] {
  if (!path) return []
  return path
    .split(',')
    .map((part) => part.trim().split('.')[0])
    .filter(Boolean)
}

/** `content.root.children` is a failure on the body — label it as the body. */
function labelFor(path: string | undefined): string {
  const parts = pathParts(path)
  if (parts.length === 0) return 'a field'
  return parts.map((part) => FIELD_LABELS[part] || part).join(' and ')
}

/**
 * What the writer should do next about one field.
 *
 * The slug gets its own sentence because the form fills it from the title: a
 * writer told only "pick a different slug" will retype the title and watch the
 * slug follow it straight back into the same collision.
 */
function sentenceFor({ path, message }: FieldError): string {
  const label = labelFor(path)
  const reason = (message || '').trim()

  if (UNIQUE.test(reason)) {
    // A slug only has to be unique within one website, so the sentence says
    // which website — "already belongs to another post" sent a writer hunting
    // through a list that does not contain it, because the post it collides
    // with belongs to a site they are not looking at.
    const parts = pathParts(path)
    if (parts.includes('slug')) {
      return parts.includes('site')
        ? 'That URL slug is already used by another post on this website. Edit the URL slug (or change the title it is synced from) and save again — the same slug on a different website is fine.'
        : 'That URL slug already belongs to another post. Edit the URL slug (or change the title it is synced from) and save again.'
    }
    return `That ${label} already belongs to another post — pick a different one and save again.`
  }

  if (REQUIRED.test(reason)) {
    return `The ${label} is required — fill it in and save again.`
  }

  return reason ? `${label}: ${reason}` : `The ${label} is invalid.`
}

/**
 * The message to show for a failed save. `fallback` is used whenever the body
 * carries nothing readable, including when it is not JSON at all.
 */
export function describeSaveError(body: unknown, fallback: string): string {
  const top = (body as { errors?: unknown } | null | undefined)?.errors
  const first = Array.isArray(top) ? (top[0] as PayloadError | undefined) : undefined
  if (!first) return fallback

  const fields = first.data?.errors
  if (Array.isArray(fields) && fields.length > 0) {
    // Several bad fields are several sentences: a writer has to fix all of
    // them, and naming only the first sends them round the loop once per field.
    return fields.map(sentenceFor).join(' ')
  }

  return typeof first.message === 'string' && first.message ? first.message : fallback
}
