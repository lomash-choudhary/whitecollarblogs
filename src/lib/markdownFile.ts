/**
 * Builds the `.md` file that gets committed into a target website's repo.
 *
 * Front matter is deliberately a FLAT key/value block (no nesting, no anchors)
 * so the receiving website can parse it with a tiny dependency-free reader.
 * Values are escaped so that a title containing a colon, a quote or a newline
 * can never corrupt the file.
 */

export type Frontmatter = Record<string, string | number | boolean | null | undefined>

/** Quote a front-matter scalar so it always survives a round trip. */
export function encodeFrontmatterValue(value: unknown): string {
  if (value === null || value === undefined) return '""'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const str = String(value)
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
  return `"${escaped}"`
}

export function buildMarkdownFile(frontmatter: Frontmatter, body: string): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === '') continue
    lines.push(`${key}: ${encodeFrontmatterValue(value)}`)
  }
  lines.push('---')
  lines.push('')
  lines.push(body.trim())
  lines.push('')
  return lines.join('\n')
}

/** Turns any string into a safe, lowercase, hyphenated file name. */
export function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}
