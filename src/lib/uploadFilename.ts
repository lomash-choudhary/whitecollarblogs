/**
 * Supabase's S3 gateway validates the *object key* against an ASCII-only
 * character set and rejects anything else with `InvalidKey: Invalid key:
 * media/<name>` — a 400 that reads like a credentials problem but is about the
 * file path. macOS screenshots are the everyday case: "Screenshot 2026-08-30 at
 * 9.45.01 PM.png" carries a narrow no-break space (U+202F) before "PM". Payload
 * runs only `sanitize-filename` on an upload, which strips path characters and
 * leaves every other Unicode codepoint in place, so the name reaches S3 as
 * typed.
 *
 * Plain spaces are accepted by the gateway, but they are replaced here too: a
 * key with spaces is percent-encoded in every URL it appears in, which makes
 * the stored `url` awkward to read and to paste into markdown.
 */
const UNSAFE = /[^a-zA-Z0-9._-]+/g
const COMBINING_MARKS = /[\u0300-\u036f]/g

const clean = (part: string): string =>
  part
    // NFKD turns U+202F into a plain space and splits an accent off its letter;
    // dropping the combining marks then leaves "café" as "cafe" rather than "caf".
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(UNSAFE, '-')
    .replace(/-{2,}/g, '-')
    // A leading dot would make the object a hidden file; a trailing one an
    // empty extension.
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()

export function toStorageSafeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  const hasExtension = lastDot > 0
  const base = hasExtension ? filename.slice(0, lastDot) : filename
  const extension = hasExtension ? filename.slice(lastDot + 1) : ''

  // A name that is entirely non-ASCII sanitizes to nothing; an empty key is
  // rejected the same way the original was.
  const safeBase = clean(base) || 'file'
  const safeExtension = clean(extension)

  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase
}
