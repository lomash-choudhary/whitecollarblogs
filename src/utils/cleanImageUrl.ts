/**
 * Utility to automatically sanitize and convert image URLs.
 * Specifically handles converting standard Unsplash photo detail page URLs
 * (e.g., https://unsplash.com/photos/ltzsbHPrEcs) to direct image files (CDN URLs)
 * that can be rendered inside HTML <img> tags.
 */
export function cleanImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  
  // Regex to match Unsplash webpage URLs: unsplash.com/photos/[slug-or-id]
  const unsplashRegex = /unsplash\.com\/photos\/([a-zA-Z0-9\-_]+)/
  const match = trimmed.match(unsplashRegex)
  if (match) {
    // Extract the ID (often the last part of a slugified path, e.g. woman-face-ltzsbHPrEcs)
    const parts = match[1].split('-')
    const photoId = parts[parts.length - 1]
    return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1200&q=80`
  }
  
  return trimmed
}
