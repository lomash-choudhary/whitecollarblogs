/**
 * Image placeholder tags — the brief a writer leaves for an image that does
 * not exist yet.
 *
 *   [Feature image — below H1, above intro. Alt text: "Painted vs refinished
 *    cabinets." Photo direction: split image, sprayed white doors on one side.]
 *
 *   **Feature image (below H1, above intro):** Alt text: "Painted vs refinished
 *   cabinets." Photo direction: split image, sprayed white doors on one side.
 *
 * Drafts arrive from the SEO writer with these already in them, so the syntax
 * is dictated by what is already being pasted rather than chosen here — which
 * is why there are two forms and not one. The second is what the SEO team's
 * own template produces; the first is this repo's original convention and is
 * kept because published drafts already use it.
 *
 * The placement note ("below H1, above intro") is **read and never acted on**.
 * The tag is already sitting on the line the image belongs on, so the position
 * of the tag itself is the position of the image and a plain in-place swap is
 * exact. Moving a block to satisfy the prose would mean resolving free English
 * — the in-content tags say things like "after the three definitions", which
 * only another model could place, and would silently reorder someone's article
 * when it guessed wrong. It is kept because it is useful to a human reading the
 * editor, and because the label half of it picks the aspect ratio.
 *
 * Resolving a tag rewrites it to an ordinary `![alt](url)` image block before
 * the post is ever saved, so this syntax never reaches `markdownBlocks.ts` and
 * none of the four site renderers need a case for it.
 */

/**
 * A tag alone on its own line.
 *
 * The brackets may be backslash-escaped: `lexicalToMarkdown` escapes `[` and
 * `]` in ordinary text, so a tag typed as `[Feature image …]` comes back from
 * the very first save as `\[Feature image …\]`. Both forms have to match or
 * the feature works exactly once per document.
 *
 * The body excludes `]` and newlines, which keeps a tag to one line and stops
 * it swallowing the rest of the article when someone forgets the closing
 * bracket. It is lazy so that the optional backslash of an escaped `\]` is
 * matched by the escape rather than swallowed into the body — greedy, every
 * tag that had been through a save ended with a stray trailing backslash.
 */
const PLACEHOLDER_LINE = /^[ \t]*\\?\[([^\]\n]+?)\\?\][ \t]*$/

/**
 * The same brief written as a **bold label** instead of a bracketed line:
 *
 *   **Feature image (below H1, above intro):** Alt text: "…" Photo direction: …
 *
 * This is the form the SEO team's drafts actually arrive in — the brackets are
 * the CMS's own convention and the writers never typed them. Unmatched, the
 * whole brief published as the article's opening paragraph, telling a reader
 * which photo to take.
 *
 * The bold is optional because a copy-paste out of Google Docs into the plain
 * markdown textarea drops it, and the placement note sits in parentheses on the
 * label rather than after a dash.
 *
 * Unlike the bracketed form this one is just an ordinary line, so it needs a
 * second guard or `**Image quality matters** on a repaint…` becomes a picture.
 * It must therefore carry one of the two field labels — every real tag has at
 * least `Alt text:` — on top of the "image" test every tag has to pass.
 */
const EMPHASIS_DELIMITERS = /\*\*|__/g

/**
 * `Feature image (below H1, above intro)` — the placement note parenthesised on
 * the label. Without pulling it back out, `label` keeps the whole note and
 * `placement`, the field this module reads it into, comes back empty.
 */
const LABEL_PARENTHETICAL = /^(.*?)\s*\(([^)]*)\)\s*$/

/**
 * Separator between the label and the rest: an em dash, an en dash, a hyphen
 * surrounded by spaces, or a colon. Google Docs rewrites `-` as `—` on paste,
 * so a tag can arrive with any of them.
 *
 * Only the **first** match separates: `String.split` on this cuts at every
 * colon in the tag, including the ones in `Alt text:` and `Photo direction:`,
 * and rejoining the pieces silently erased the two field labels this whole
 * module exists to read.
 */
const LABEL_SEPARATOR = /\s*[—–]\s*|\s+-\s+|\s*:\s*/

const ALT_LABEL = /alt\s*text\s*:/i
const DIRECTION_LABEL = /photo\s*direction\s*:/i

/** Straight and smart quotes both, for the same paste-from-Docs reason. */
const SURROUNDING_QUOTES = /^["'“”‘’]+|["'“”‘’]+$/g

export interface ImagePlaceholder {
  /** Exact source text of the line, used to swap it back out again. */
  raw: string
  /** Character offset of `raw` in the markdown. */
  index: number
  /** 1-based line number, for error messages a writer has to act on. */
  line: number
  /** "Feature image", "In-content image" — picks the aspect ratio. */
  label: string
  /** "below H1, above intro" — shown to a human, never acted on. */
  placement: string
  /** Becomes the real `![alt]`, and seasons the prompt. */
  alt: string
  /** The prompt. Falls back to the alt text, which many tags only have. */
  direction: string
}

/**
 * Pulls `Alt text:` and `Photo direction:` out of a tag body.
 *
 * Both are optional and either order is accepted, because the in-content tags
 * in a real draft carry only an alt text. A tag with neither is still a
 * placeholder — its whole body becomes the prompt — so a writer who types
 * `[Feature image — a red front door]` gets something rather than silence.
 */
function splitFields(body: string): { placement: string; alt: string; direction: string } {
  const altAt = body.search(ALT_LABEL)
  const directionAt = body.search(DIRECTION_LABEL)

  const cut = (from: number, labelPattern: RegExp): string => {
    if (from < 0) return ''
    const after = body.slice(from).replace(labelPattern, '')
    // The other field, whichever it is, ends this one.
    const ends = [after.search(ALT_LABEL), after.search(DIRECTION_LABEL)].filter((at) => at > 0)
    const end = ends.length > 0 ? Math.min(...ends) : after.length
    return after.slice(0, end).trim().replace(/[.,;]$/, '').replace(SURROUNDING_QUOTES, '').trim()
  }

  const labelled = [altAt, directionAt].filter((at) => at >= 0)
  const placementEnd = labelled.length > 0 ? Math.min(...labelled) : body.length

  return {
    placement: body.slice(0, placementEnd).trim().replace(/[.,;]$/, '').trim(),
    alt: cut(altAt, ALT_LABEL),
    direction: cut(directionAt, DIRECTION_LABEL),
  }
}

/**
 * Every unresolved image tag in a markdown document, in document order.
 *
 * The label must mention "image", so an ordinary bracketed line — a `[1]`
 * footnote marker, a stray reference link — is left alone. A false positive
 * here would silently delete a writer's line and replace it with a generated
 * picture, which is far worse than missing a tag.
 */
export function findImagePlaceholders(markdown: string): ImagePlaceholder[] {
  const found: ImagePlaceholder[] = []
  if (!markdown) return found

  let offset = 0
  const lines = markdown.split('\n')

  lines.forEach((rawLine, i) => {
    const index = offset
    offset += rawLine.length + 1

    const bracketed = rawLine.match(PLACEHOLDER_LINE)
    const body = bracketed
      ? bracketed[1].trim()
      : rawLine.replace(EMPHASIS_DELIMITERS, '').trim()
    if (!body) return
    // An unbracketed line is only a tag if it names one of the two fields.
    if (!bracketed && !ALT_LABEL.test(body) && !DIRECTION_LABEL.test(body)) return

    const separator = body.match(LABEL_SEPARATOR)
    const written = (separator ? body.slice(0, separator.index) : body).trim()
    const parenthesised = written.match(LABEL_PARENTHETICAL)
    const label = (parenthesised ? parenthesised[1] : written).trim()
    if (!/image/i.test(label)) return

    const remainder = separator
      ? body.slice((separator.index || 0) + separator[0].length).trim()
      : ''
    const fields = splitFields(remainder || body)
    const placement = fields.placement || (parenthesised ? parenthesised[2].trim() : '')
    // A tag with no `Alt text:` still needs an alt: the photo direction
    // describes the picture, so it reads better than the bare label would.
    const alt = fields.alt || fields.direction || remainder || label
    const direction = fields.direction || fields.alt || remainder || label

    found.push({
      raw: rawLine,
      index,
      line: i + 1,
      label,
      placement,
      alt,
      direction,
    })
  })

  return found
}

/**
 * Aspect ratio for a tag, from its label.
 *
 * A feature image runs the full width of the article under the title and wants
 * to be wide; an image dropped between two sections sits in the text column and
 * a 16:9 strip there is mostly letterboxing.
 */
export function aspectRatioFor(label: string): string {
  return /feature|hero|banner|cover/i.test(label) ? '16:9' : '4:3'
}

/**
 * The prompt sent to the image model.
 *
 * The photo direction is the writer's actual instruction and leads. The alt
 * text follows only when it adds something the direction does not already say,
 * because on a tag with no direction the two are the same string and repeating
 * it just weights those words twice.
 */
export function promptFor(placeholder: Pick<ImagePlaceholder, 'alt' | 'direction'>): string {
  const { alt, direction } = placeholder
  const parts = [direction]
  if (alt && alt.toLowerCase() !== direction.toLowerCase()) parts.push(alt)
  const brief = parts
    .map((part) => part.trim().replace(/\s*\.\s*$/, ''))
    .filter(Boolean)
    .join('. ')
  return `${brief}. Photorealistic editorial photograph for a home-improvement article. No text, no watermarks, no logos.`
}

/** `]` in alt text would close the image early and print the URL as prose. */
function escapeAlt(alt: string): string {
  return alt.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Swaps one resolved tag for the image block it described.
 *
 * Matched by offset rather than by string, because a document can hold two
 * identical tags and a `replace()` on the text would rewrite the first one
 * twice and leave the second forever.
 */
export function replaceImagePlaceholder(
  markdown: string,
  placeholder: ImagePlaceholder,
  url: string,
  alt?: string,
): string {
  const before = markdown.slice(0, placeholder.index)
  const after = markdown.slice(placeholder.index + placeholder.raw.length)
  return `${before}![${escapeAlt(alt || placeholder.alt)}](${url})${after}`
}
