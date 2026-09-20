/**
 * Converts an uploaded Word document into the markdown the editor works in.
 *
 *   POST /api/import-docx   multipart/form-data, field `file`
 *   -> { "markdown": "...", "imageBriefs": 0 }
 *
 * **Only `.docx` comes here.** A `.md` upload is read in the browser and put
 * straight into the body — there is nothing to convert, and a round trip to
 * the server to hand the same bytes back would be the kind of work that looks
 * like a feature and is only latency.
 *
 * The conversion itself is `src/lib/docxToMarkdown.ts`; this route is the
 * boundary around it — authentication, a size ceiling, and the one failure a
 * writer can act on (the file is not a Word document).
 */
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { docxToMarkdown } from '@/lib/docxToMarkdown'

// Mammoth unzips and walks the document in-process, so this is a Node route,
// not an edge one.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * A 3,000-word article converts in well under a second; this is headroom for a
 * document with a lot of embedded images, whose bytes still have to be read
 * even though the pictures themselves are dropped.
 */
export const maxDuration = 60

/**
 * Bigger than any article anyone has handed over (the largest `.docx` in
 * `docx/` is 17KB) and small enough that a mistaken upload — a video, a
 * folder's worth of scans — is refused before it is read into memory rather
 * than after.
 */
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (!user) {
      // Unauthenticated this would let anyone on the internet spend this
      // server's memory unzipping documents they uploaded.
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file was attached. Choose a .docx file and try again.' },
        { status: 400 },
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'That file is empty. Check the download and try again.' },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB, and the limit is ${
            MAX_BYTES / 1024 / 1024
          }MB. An article document is normally well under 1MB — check you picked the right file.`,
        },
        { status: 413 },
      )
    }

    // `.doc` is a different format entirely (OLE2, not a zip), and mammoth
    // reads only `.docx`. Saying so is the difference between a writer
    // re-saving the file in Word and a writer filing a bug.
    if (file.name.toLowerCase().endsWith('.doc')) {
      return NextResponse.json(
        {
          error:
            'That is an older .doc file. Open it in Word or Google Docs and save it as .docx, then upload it again.',
        },
        { status: 415 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let converted
    try {
      converted = await docxToMarkdown(buffer)
    } catch {
      // Mammoth throws on anything that is not a readable Word document — a
      // renamed PDF, a corrupt download. Its own message talks about zip
      // central directories, which tells a writer nothing.
      return NextResponse.json(
        {
          error:
            'That file could not be read as a Word document. Re-download it from Google Docs (File > Download > Microsoft Word) and try again.',
        },
        { status: 415 },
      )
    }

    if (converted.warnings.length > 0) {
      // Unmapped styles and the like. Useful when a document comes out wrong,
      // and meaningless to the writer, so it goes to the server log.
      console.warn('[import-docx] mammoth notes:', converted.warnings.join(' | '))
    }

    if (!converted.markdown.trim()) {
      return NextResponse.json(
        {
          error:
            'That document converted to an empty article. If the text is inside a text box or an image, Word puts it somewhere markdown cannot reach — paste the text in instead.',
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      markdown: converted.markdown,
      imageBriefs: converted.imageBriefs,
    })
  } catch (err) {
    // Never `err.message` here: an unexpected throw in this route is a Payload
    // or database failure, and a Postgres error quotes the host and user out
    // of DATABASE_URI straight back at the browser.
    console.error('[import-docx] unexpected failure:', err)
    return NextResponse.json(
      { error: 'The document could not be imported. Try again, and paste the text in if it keeps failing.' },
      { status: 500 },
    )
  }
}
