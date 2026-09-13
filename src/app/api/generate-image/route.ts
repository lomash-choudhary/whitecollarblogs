/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generates one article image from a writer's placeholder tag and stores it.
 *
 *   POST /api/generate-image  { "direction": "...", "alt": "...", "label": "..." }
 *   -> { "url": "https://<ref>.supabase.co/.../media/generated-....jpg", "alt": "..." }
 *
 * One image per call. The editor resolves a document's tags one at a time so
 * that a model failure on the third image leaves the first two in place, and
 * so the writer sees progress on an article with half a dozen of them.
 *
 * The result is uploaded into the `media` collection rather than handed back
 * as a model URL or a data URI: the markdown is committed into the site repos,
 * every site scopes `images.remotePatterns` to named hosts, and `next/image`
 * *throws* on an unconfigured host — one foreign image host takes the whole
 * article page down with a 500 rather than showing a broken image. Going
 * through `media` gives the same `**.supabase.co` URL every uploaded image
 * already uses, which all four sites already allow.
 */
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { aspectRatioFor, promptFor } from '@/lib/imagePlaceholders'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Generation runs ~8s, plus the sharp resize and the Supabase upload, so this
// needs room beyond the platform default (10s Hobby, 15s Pro). Vercel enforces
// the *lower* of this and the plan ceiling, so without it the function is
// killed mid-call and the writer gets a raw FUNCTION_INVOCATION_TIMEOUT instead
// of the message below.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Generation is slow by nature; the ceiling is here so a hung call ends.
 *
 * It has to stay *under* `maxDuration`, or the platform kills the function
 * first and this route's own "took too long" message never gets to send.
 */
const TIMEOUT_MS = 55_000

/**
 * Digs the base64 bytes out of a response.
 *
 * Two shapes are accepted: the single-image `output_image`, and the
 * `steps[].content[]` list a model returns when it interleaves commentary with
 * the picture. Taking only the first form meant a chatty response read as "no
 * image returned" even though one was sitting in the payload.
 */
function extractImage(json: any): { data: string; mimeType: string } | null {
  const interaction = json?.interaction ?? json
  const direct = interaction?.output_image
  if (direct?.data) {
    return { data: direct.data, mimeType: direct.mime_type || 'image/jpeg' }
  }

  const steps = Array.isArray(interaction?.steps) ? interaction.steps : []
  for (const step of steps) {
    const content = Array.isArray(step?.content) ? step.content : []
    for (const part of content) {
      if (part?.data && String(part?.type || '').includes('image')) {
        return { data: part.data, mimeType: part.mime_type || 'image/jpeg' }
      }
    }
  }
  return null
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  return 'jpg'
}

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (!user) {
      // Unauthenticated this would be a public endpoint that spends money on
      // every request, so it is closed before anything else is even read.
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    // The model id has no code default on purpose. Image models are replaced
    // far more often than this route is edited, and a hard-coded one goes stale
    // silently: the call keeps working against an older, worse model and
    // nothing says so. Naming the var is the only way the operator finds out.
    const apiKey = process.env.GEMINI_API_KEY
    const model = process.env.GEMINI_IMAGE_MODEL
    const missing = [
      !apiKey && 'GEMINI_API_KEY',
      !model && 'GEMINI_IMAGE_MODEL',
    ].filter(Boolean)

    // Tested as two conditions rather than on `missing.length`, which reads
    // better but narrows neither value for the request below.
    if (!apiKey || !model) {
      return NextResponse.json(
        {
          error: `Image generation is not configured — set ${missing.join(
            ' and ',
          )} in this app's environment, then try again. Your article is unchanged.`,
        },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const direction = String(body?.direction || '').trim()
    const alt = String(body?.alt || '').trim()
    const label = String(body?.label || '')
    if (!direction && !alt) {
      return NextResponse.json(
        { error: 'This tag has no photo direction and no alt text, so there is nothing to draw. Add one and generate again.' },
        { status: 400 },
      )
    }

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [{ type: 'text', text: promptFor({ alt, direction: direction || alt }) }],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: aspectRatioFor(label),
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      // The key and the quota are the two that a writer can actually act on,
      // so they are named rather than folded into a generic failure.
      const hint =
        response.status === 429
          ? 'The image API is rate limited right now — wait a minute and generate again.'
          : response.status === 404
            ? `The image API has no model called "${model}". Check GEMINI_IMAGE_MODEL is a current image model id.`
            : response.status === 400 || response.status === 403
              ? `The image API rejected the request. Check GEMINI_API_KEY is valid, and that GEMINI_IMAGE_MODEL ("${model}") is an image model rather than a text one.`
              : 'The image API is unavailable — try again in a moment.'
      payload.logger.error(`generate-image: ${response.status} ${detail.slice(0, 500)}`)
      return NextResponse.json({ error: hint }, { status: 502 })
    }

    const image = extractImage(await response.json())
    if (!image) {
      return NextResponse.json(
        { error: 'The model returned no image, usually because the photo direction was refused. Reword it and generate again.' },
        { status: 502 },
      )
    }

    const buffer = Buffer.from(image.data, 'base64')
    const name = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(image.mimeType)}`

    const media: any = await payload.create({
      collection: 'media',
      data: { alt: alt || direction },
      file: { data: buffer, mimetype: image.mimeType, name, size: buffer.length },
    })

    if (!media?.url) {
      return NextResponse.json(
        { error: 'The image was generated but could not be stored. Check the media storage settings and try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: media.url, alt: alt || direction })
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    if (timedOut) {
      return NextResponse.json(
        { error: 'The image took too long to generate. Try again, or simplify the photo direction.' },
        { status: 504 },
      )
    }

    // An unexpected throw here is a database or storage failure, and those
    // messages quote connection details back at you — a Postgres error can
    // carry the host and user from DATABASE_URI. It goes to the server log,
    // where the operator can read it, and never into the browser.
    console.error('[generate-image] unexpected failure:', err)
    return NextResponse.json(
      { error: 'Image generation failed unexpectedly. Check the server logs, then try again. Your article is unchanged.' },
      { status: 500 },
    )
  }
}
