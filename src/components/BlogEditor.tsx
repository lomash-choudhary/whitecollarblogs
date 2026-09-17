/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Check, 
  Clock, 
  Image as ImageIcon,
  CalendarClock,
  Loader2,  
  Send,
  Upload,
  Trash2,
  Link2,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  Code,
  Quote,
  List,
  ListOrdered,
  Table,
  Paperclip,
  Strikethrough,
  Minus,
  SquareCode,
  Image as ImageIconLucide,
  ListChecks,
  Info,
  HelpCircle,
  Sparkles,
  Search,
  ChevronDown,
  FileDown
} from 'lucide-react'
import { cleanImageUrl } from '@/utils/cleanImageUrl'
import { findImagePlaceholders, replaceImagePlaceholder } from '@/lib/imagePlaceholders'
import {
  formatSeoBlock,
  joinSeoBlock,
  readDocFrontMatter,
  readSeoBlock,
} from '@/lib/docFrontMatter'
import { describeSaveError } from '@/lib/saveError'
import { lexicalToMarkdown } from '@/utils/lexicalToMarkdown'
import { markdownToLexical } from '@/utils/markdownToLexical'
import { useSite } from '@/context/SiteContext'

interface Author {
  id: string
  name: string
  role: string
}

interface Stage {
  id: string
  name: string
  key: string
}

interface BlogEditorProps {
  authors: Author[]
  stages: Stage[]
  initialPost?: {
    id: string | number
    title: string
    slug: string
    excerpt?: string
    metaTitle?: string
    metaDescription?: string
    metaKeywords?: string
    canonicalUrl?: string
    coverImageAlt?: string
    ogImageUrl?: string
    targetKeyword?: string
    content: any
    targetRole?: string
    readTime?: string
    author: string | number
    stage: string | number
    coverImageUrl?: string
    coverImage?: string | number
    site?: string
    externalStatus?: string
    externalMessage?: string
    externalUrl?: string
    scheduledFor?: string
    scheduleStatus?: string
    scheduleMessage?: string
  } | null
}


/**
 * Uploads one file into the `media` collection and returns the created doc.
 *
 * Shared by the cover-image picker and the in-body attachment button so both
 * send the same request and read the same error out of a rejected upload.
 */
async function uploadToMedia(file: File, alt: string): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('alt', alt)

  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.errors?.[0]?.message || 'Upload failed. Make sure you are logged in.')
  }

  return (await res.json()).doc
}

/**
 * A relationship id as Payload expects it: numeric for a Postgres serial id,
 * left as a string for anything else.
 */
function relationValue(id: string | number): string | number {
  return /^\d+$/.test(String(id)) ? Number(id) : id
}

/** How an uploaded file is written into the body, by what kind of file it is. */
function attachmentMarkdown(fileName: string, url: string, mimeType: string): string {
  if (mimeType.startsWith('image/')) return `\n![${fileName}](${url})\n`
  if (mimeType.startsWith('video/')) return `\n![video](${url})\n`
  return `\n[📄 Download ${fileName}](${url})\n`
}

interface MarkdownSnippet {
  replacement: string
  /**
   * Characters to walk the caret back from the end of the inserted text, so it
   * lands inside the placeholder rather than after the closing delimiter. Zero
   * whenever the writer had a selection, which is already the text they want.
   */
  cursorOffset?: number
}

/**
 * What each toolbar button inserts. A table rather than a switch because every
 * entry is data: the syntax it writes is the syntax `markdownBlocks` reads
 * back, so the two are compared by reading them side by side.
 */
const MARKDOWN_SNIPPETS: Record<string, (selected: string) => MarkdownSnippet> = {
  bold: (s) => ({ replacement: `**${s || 'bold text'}**`, cursorOffset: s ? 0 : 2 }),
  italic: (s) => ({ replacement: `*${s || 'italic text'}*`, cursorOffset: s ? 0 : 1 }),
  underline: (s) => ({ replacement: `__${s || 'underlined text'}__`, cursorOffset: s ? 0 : 2 }),
  strike: (s) => ({ replacement: `~~${s || 'struck text'}~~`, cursorOffset: s ? 0 : 2 }),
  code: (s) => ({ replacement: `\`${s || 'code block'}\``, cursorOffset: s ? 0 : 1 }),

  link: (s) => ({
    replacement: `[${s || 'link text'}](https://example.com)`,
    cursorOffset: s ? 0 : 21,
  }),
  'link-nofollow': (s) => ({
    replacement: `[${s || 'link text'}](https://example.com "nofollow")`,
    cursorOffset: s ? 0 : 32,
  }),

  h1: (s) => ({ replacement: `\n# ${s || 'Heading 1'}\n` }),
  h2: (s) => ({ replacement: `\n## ${s || 'Heading 2'}\n` }),
  h3: (s) => ({ replacement: `\n### ${s || 'Heading 3'}\n` }),

  quote: (s) => ({ replacement: `\n> ${s || 'Quote'}\n` }),
  ul: (s) => ({ replacement: `\n- ${s || 'List item'}\n` }),
  ol: (s) => ({ replacement: `\n1. ${s || 'List item'}\n` }),
  divider: () => ({ replacement: `\n---\n` }),
  image: (s) => ({
    replacement: `\n![${s || 'describe the image'}](https://example.com/image.jpg "optional caption")\n`,
  }),
  table: (s) => ({
    replacement: s
      ? `\n| ${s} | Column 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n`
      : `\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |\n`,
  }),
  // Fenced, so the whole block survives the save. An indented block or a bare
  // newline would be read back as an ordinary paragraph.
  codeblock: (s) => ({ replacement: `\n\`\`\`\n${s || 'code here'}\n\`\`\`\n` }),

  // The heading is the syntax: every site turns "Key Takeaways" plus the
  // bullets under it into its own styled box, and "## FAQ" plus "###"
  // questions into the accordion.
  takeaways: (s) => ({
    replacement: `\n## Key Takeaways\n\n- ${s || 'First takeaway'}\n- Second takeaway\n- Third takeaway\n`,
  }),
  faq: (s) => ({
    replacement: `\n## FAQ\n\n### ${s || 'First question?'}\n\nThe answer.\n\n### Second question?\n\nThe answer.\n`,
  }),

  'callout-note': (s) => ({ replacement: `\n:::note\n${s || 'Something worth knowing.'}\n:::\n` }),
  'callout-tip': (s) => ({ replacement: `\n:::tip\n${s || 'A helpful tip.'}\n:::\n` }),
  'callout-warning': (s) => ({
    replacement: `\n:::warning\n${s || 'Something to watch out for.'}\n:::\n`,
  }),
  'callout-key': (s) => ({ replacement: `\n:::key ${s || 'Key point'}\nWhy it matters.\n:::\n` }),
}

export const BlogEditor: React.FC<BlogEditorProps> = ({ authors, stages, initialPost }) => {
  const { sites, activeSite } = useSite()
  // The destination comes from the sidebar switcher, so the form has no picker
  // for it. A new post targets whichever website is selected there; an existing
  // post keeps the one it was created for.
  const siteKey = initialPost?.site || activeSite.key
  const targetSite = sites.find((s) => s.key === siteKey) || activeSite

  const router = useRouter()
  const isEditing = Boolean(initialPost)

  const [title, setTitle] = useState(initialPost?.title || '')
  const [slug, setSlug] = useState(initialPost?.slug || '')
  // Synced by default for new posts. If editing, preserve the existing slug without dynamic updates.
  const [isSyncedWithTitle, setIsSyncedWithTitle] = useState(!isEditing)
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || '')

  // The SEO fields. Every one is optional and falls back on the site side
  // (src/lib/articleSeo.ts), so an untouched post publishes exactly the tags
  // it always did.
  //
  // These are state rather than the source of truth. When the body opens with
  // an SEO block — which it does for anything that came out of a Google Doc —
  // the block is what the writer edits and these mirror it. The panel below is
  // the fallback for an article that has no block, and it is only rendered
  // then, because two editable copies of one value can only disagree.
  const [seoOpen, setSeoOpen] = useState(false)
  const [metaTitle, setMetaTitle] = useState(initialPost?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(initialPost?.metaDescription || '')
  const [metaKeywords, setMetaKeywords] = useState(initialPost?.metaKeywords || '')
  const [canonicalUrl, setCanonicalUrl] = useState(initialPost?.canonicalUrl || '')
  const [coverImageAlt, setCoverImageAlt] = useState(initialPost?.coverImageAlt || '')
  const [ogImageUrl, setOgImageUrl] = useState(initialPost?.ogImageUrl || '')
  const [targetKeyword, setTargetKeyword] = useState(initialPost?.targetKeyword || '')
  const seoFilledCount = [
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    coverImageAlt,
    ogImageUrl,
    targetKeyword,
  ].filter((value) => value.trim()).length

  // The stored body never contains the block — it is written back on top of it
  // here, and taken off again on save. Keeping it out of the column is what
  // stops it reaching a renderer: nothing in `markdownBlocks.ts` knows what a
  // `Meta Title:` line means, so a stored one would publish as the article's
  // opening paragraph on whichever site the post goes to.
  const [content, setContent] = useState(() => {
    if (!initialPost) return ''
    return joinSeoBlock(
      formatSeoBlock({
        metaTitle: initialPost.metaTitle,
        metaDescription: initialPost.metaDescription,
        metaKeywords: initialPost.metaKeywords,
        targetKeyword: initialPost.targetKeyword,
        canonicalUrl: initialPost.canonicalUrl,
        coverImageAlt: initialPost.coverImageAlt,
        ogImageUrl: initialPost.ogImageUrl,
      }),
      lexicalToMarkdown(initialPost.content),
    )
  })

  /** The block at the top of the body, and the article below it. */
  const seoBlock = React.useMemo(() => readSeoBlock(content), [content])

  // Mirrors the block into the fields, so deleting it leaves the panel holding
  // what it said rather than an empty form.
  React.useEffect(() => {
    if (!seoBlock.present) return
    setMetaTitle(seoBlock.fields.metaTitle || '')
    setMetaDescription(seoBlock.fields.metaDescription || '')
    setMetaKeywords(seoBlock.fields.metaKeywords || '')
    setTargetKeyword(seoBlock.fields.targetKeyword || '')
    setCanonicalUrl(seoBlock.fields.canonicalUrl || '')
    setCoverImageAlt(seoBlock.fields.coverImageAlt || '')
    setOgImageUrl(seoBlock.fields.ogImageUrl || '')
  }, [seoBlock])
  const contentRef = React.useRef<HTMLTextAreaElement>(null)
  const mediaInputRef = React.useRef<HTMLInputElement>(null)
  const [isMediaUploading, setIsMediaUploading] = useState(false)

  const triggerFileUpload = () => {
    mediaInputRef.current?.click()
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsMediaUploading(true)
    try {
      const doc = await uploadToMedia(file, file.name)
      const textarea = contentRef.current
      if (doc?.url && textarea) {
        const markdownInsert = attachmentMarkdown(
          doc.filename || file.name,
          doc.url,
          file.type || '',
        )
        const start = textarea.selectionStart
        const text = textarea.value
        setContent(text.substring(0, start) + markdownInsert + text.substring(textarea.selectionEnd))

        setTimeout(() => {
          textarea.focus()
          const caret = start + markdownInsert.length
          textarea.setSelectionRange(caret, caret)
        }, 0)
      }
    } catch {
      alert('Failed to upload file. Please verify it is a valid format.')
    } finally {
      setIsMediaUploading(false)
      // reset file input
      if (mediaInputRef.current) {
        mediaInputRef.current.value = ''
      }
    }
  }

  const applyFormatting = (formatType: string) => {
    const textarea = contentRef.current
    if (!textarea) return

    const build = MARKDOWN_SNIPPETS[formatType]
    if (!build) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const { replacement, cursorOffset = 0 } = build(text.substring(start, end))

    setContent(text.substring(0, start) + replacement + text.substring(end))

    setTimeout(() => {
      textarea.focus()
      const caret = start + replacement.length - cursorOffset
      textarea.setSelectionRange(caret, caret)
    }, 0)
  }

  const [targetRole, setTargetRole] = useState(
    initialPost?.targetRole || targetSite.defaultCategory,
  )
  
  // Derive reading time dynamically from content length to avoid useEffect state updates
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.ceil(words / 200))
  const readTime = `${minutes} min read`

  const [selectedAuthor, setSelectedAuthor] = useState(initialPost?.author || authors[0]?.id || '')
  const [selectedStage, setSelectedStage] = useState(initialPost?.stage || stages[stages.length - 1]?.id || '')

  // <input type="datetime-local"> speaks local wall-clock time with no zone,
  // so it has to be converted to and from the UTC instant we store.
  const toLocalInputValue = (iso?: string) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const offsetMs = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  }

  const [scheduledFor, setScheduledFor] = useState(toLocalInputValue(initialPost?.scheduledFor))
  const selectedStageKey = stages.find((st) => String(st.id) === String(selectedStage))?.key
  const isScheduledStage = selectedStageKey === 'scheduled'
  // Cannot schedule into the past; give the picker a floor of "now".
  const earliestSchedule = toLocalInputValue(new Date().toISOString())
  const [coverImageUrl, setCoverImageUrl] = useState(initialPost?.coverImageUrl || '')
  const [uploadedMediaId, setUploadedMediaId] = useState<any | null>(initialPost?.coverImage || null)
  const [isUploading, setIsUploading] = useState(false)
  const [imageSource, setImageSource] = useState<'upload' | 'url'>(
    initialPost?.coverImage ? 'upload' : (initialPost?.coverImageUrl ? 'url' : 'upload')
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    setError(null)
    
    try {
      const doc = await uploadToMedia(file, `Cover for ${title || 'blog'}`)
      if (!doc?.id) throw new Error('Invalid response from media server.')
      setUploadedMediaId(doc.id)
      setCoverImageUrl(doc.url)
    } catch (err: any) {
      setError(err.message || 'Failed to upload image.')
      setCoverImageUrl('')
      setUploadedMediaId(null)
    } finally {
      setIsUploading(false)
    }
  }

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryResult, setRetryResult] = useState<string | null>(null)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null)

  // Recomputed as the writer types, so the button's count is always the number
  // of tags actually left in the body rather than a stale one from load.
  const pendingImages = React.useMemo(() => findImagePlaceholders(content), [content])

  // What a Google Docs export still has left to give: the SEO block it opens
  // with, and its own title line. Recomputed with the body so the button
  // disappears the moment there is nothing left to lift, and read past the
  // editor's own block, or it would offer to import the lines it just wrote
  // and never stop offering.
  const pendingImport = React.useMemo(() => readDocFrontMatter(seoBlock.body), [seoBlock.body])

  /**
   * Moves a pasted Google Docs export's front matter into the fields it was
   * written for, and its title line into the title box.
   *
   * A field is only filled when it is **empty**. The document is authoritative
   * about its own metadata, but the person at the keyboard is authoritative
   * about the form they have already filled in — silently overwriting a meta
   * description someone just rewrote would be the worst kind of helpful.
   *
   * The title line is removed from the body either way, because that is the
   * defect being fixed: left in, it publishes a second `<h1>` under the page's
   * own title on all four sites. Nothing is lost when the title box already
   * holds it.
   */
  const applyDocImport = (markdown: string): string => {
    const { body, fields, consumed } = readDocFrontMatter(markdown)
    if (consumed.length === 0) return markdown

    /**
     * A box the writer has already filled in wins over the document. Both of
     * these are visible on the form without scrolling, so a skipped value is
     * a value they can see — which is why the import does not announce it.
     */
    const fill = (value: string | undefined, current: string, set: (next: string) => void) => {
      if (!value || current.trim()) return
      set(value)
    }

    fill(fields.title, title, (next) => {
      setTitle(next)
      // Only when the doc gave no slug of its own: the sync would otherwise
      // overwrite the SEO team's slug with one derived from the title.
      if (isSyncedWithTitle && !fields.slug) {
        setSlug(next.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''))
      }
    })
    fill(fields.slug, slug, (next) => {
      setSlug(next)
      setIsSyncedWithTitle(false)
    })

    // The SEO fields are not set here. They go back into the body as the block
    // above the article, which is where the writer edits them from now on —
    // the effect above copies them into the columns. What is already typed
    // wins over the document, the same rule `fill` applies to title and slug.
    const block = formatSeoBlock({
      metaTitle: metaTitle.trim() || fields.metaTitle,
      metaDescription: metaDescription.trim() || fields.metaDescription,
      metaKeywords: metaKeywords.trim() || fields.metaKeywords,
      targetKeyword: targetKeyword.trim() || fields.targetKeyword,
      canonicalUrl: canonicalUrl.trim() || fields.canonicalUrl,
      coverImageAlt: coverImageAlt.trim() || fields.coverImageAlt,
      ogImageUrl: ogImageUrl.trim() || fields.ogImageUrl,
    })

    return joinSeoBlock(block, body)
  }

  /**
   * Runs the import when the paste is a whole document rather than a snippet.
   *
   * Anchored to "this paste replaces everything" — an empty box, or a select-all
   * before pasting — because that is the writer dropping in a downloaded export,
   * which is the only moment the leading `#` is reliably the article's title
   * and not a heading they meant to write. A paste into the middle of an
   * article is left completely alone.
   */
  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const replacesEverything =
      textarea.value.trim() === '' ||
      (textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length)
    if (!replacesEverything) return

    const pasted = e.clipboardData.getData('text/plain')
    if (!pasted.trim()) return

    const { consumed } = readDocFrontMatter(pasted)
    if (consumed.length === 0) return

    e.preventDefault()
    setContent(applyDocImport(pasted))
  }

  // A publish can fail for reasons that have nothing to do with the article —
  // an expired token, GitHub being down. Re-saving does not help, because an
  // unchanged post is deliberately not re-dispatched, so offer a direct retry.
  const retryPublish = async () => {
    if (!initialPost?.id) return
    setRetrying(true)
    setRetryResult(null)
    try {
      const res = await fetch('/api/publish-external', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: initialPost.id }),
      })
      const data = await res.json().catch(() => ({}))
      setRetryResult(res.ok ? data.message || 'Sent.' : data.error || 'Retry failed.')
      if (res.ok) router.refresh()
    } catch {
      setRetryResult('Could not reach the server.')
    } finally {
      setRetrying(false)
    }
  }

  /**
   * Turns every `[Feature image — …]` tag in the body into a real image.
   *
   * Deliberately a button rather than something the save hook does. Generation
   * takes tens of seconds per image, and a save that quietly waited on it would
   * hold a database connection open across the whole call — the pool is three
   * wide. A button also lets the writer look at the result and run it again
   * before the article goes anywhere.
   *
   * Each tag is resolved in its own request and the textarea is updated as each
   * one lands, so a failure on the fourth image keeps the first three.
   */
  const generateImages = async () => {
    const total = findImagePlaceholders(content).length
    if (total === 0) return

    setIsGeneratingImages(true)
    setImageProgress({ done: 0, total })
    setError(null)

    let working = content
    // Index of the tag to try next. A resolved tag leaves the list, so this
    // only moves forward past one that failed — without it, a tag the model
    // refuses would be retried until the loop ran out.
    let cursor = 0
    let done = 0
    const failures: string[] = []

    for (let attempt = 0; attempt < total; attempt++) {
      const placeholder = findImagePlaceholders(working)[cursor]
      if (!placeholder) break

      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: placeholder.direction,
            alt: placeholder.alt,
            label: placeholder.label,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || 'Image generation failed.')
        }

        working = replaceImagePlaceholder(working, placeholder, data.url, data.alt)
        setContent(working)
        done += 1
        setImageProgress({ done, total })
      } catch (err: any) {
        failures.push(`line ${placeholder.line}: ${err?.message || 'failed'}`)
        cursor += 1
      }
    }

    if (failures.length > 0) {
      setError(
        `${done} of ${total} images generated. Still to do — ${failures.join('; ')}. The tags that failed are untouched, so you can fix the wording and generate again.`,
      )
    }

    setIsGeneratingImages(false)
    setImageProgress(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // The block comes off the top before the body is stored, and the values
    // it carried are what gets saved. Read straight from the parse rather than
    // from the mirrored state: at submit they agree, but only one of the two
    // is guaranteed to have seen the writer's last keystroke.
    const lexicalContent = markdownToLexical(seoBlock.body)
    const seo = seoBlock.present
      ? {
          metaTitle: seoBlock.fields.metaTitle || '',
          metaDescription: seoBlock.fields.metaDescription || '',
          metaKeywords: seoBlock.fields.metaKeywords || '',
          canonicalUrl: seoBlock.fields.canonicalUrl || '',
          coverImageAlt: seoBlock.fields.coverImageAlt || '',
          ogImageUrl: seoBlock.fields.ogImageUrl || '',
          targetKeyword: seoBlock.fields.targetKeyword || '',
        }
      : {
          metaTitle,
          metaDescription,
          metaKeywords,
          canonicalUrl: canonicalUrl.trim(),
          coverImageAlt,
          ogImageUrl,
          targetKeyword,
        }

    try {
      const url = isEditing ? `/api/posts/${initialPost?.id}` : '/api/posts'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          content: lexicalContent,
          targetRole,
          readTime,
          author: relationValue(selectedAuthor),
          stage: relationValue(selectedStage),
          scheduledFor:
            isScheduledStage && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          site: siteKey,
          // Sent as '' rather than undefined when cleared: undefined leaves the
          // old value in the row, so emptying a meta box would look like it
          // saved and keep publishing the value the writer just deleted.
          ...seo,
          ogImageUrl: cleanImageUrl(seo.ogImageUrl),
          coverImageUrl: cleanImageUrl(coverImageUrl) || undefined,
          coverImage: uploadedMediaId || undefined,
          ...(isEditing ? {} : { views: 0, likes: 0, publishDate: new Date().toISOString() }),
        }),
      })

      if (!response.ok) {
        // Payload names the bad field in its top-level message and puts the
        // reason a level down, so read the whole body rather than the summary.
        const errorData = await response.json().catch(() => null)
        throw new Error(describeSaveError(errorData, 'Failed to submit article. Please try again.'))
      }

      setSuccess(true)

      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } catch (err: any) {
      console.error('Error submitting post:', err)
      setError(err.message || 'An unexpected error occurred while saving.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300 text-left font-body">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-[#0D1B2A] tracking-tight font-headline">
          {isEditing ? 'Edit WCA Blog Post' : 'Draft New WCA Blog Post'}
        </h2>
        <p className="text-xs text-[#0D1B2A]/50 font-semibold mt-1">
          {isEditing ? 'Update existing mitigation insights for the archive' : 'Deploy fresh federal prep insights for defendants'}
        </p>
      </div>

      <div className="bg-white p-6 md:p-8 relative overflow-hidden rounded-3xl border border-[rgba(13,27,42,0.1)] shadow-sm">
        {/* Top brand accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-[#C9A84C]"></div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-600">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shadow-inner">
              <Check className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              {/* What the writer did, not what the machinery did with it. A
                  publish to another site is a GitHub dispatch, a rebuild and a
                  deploy, and none of those are the writer's business or under
                  their control — naming them invited a question about a repo
                  they have never seen. */}
              <h3 className="text-sm font-bold text-slate-800">
                {selectedStageKey === 'published'
                  ? 'Article published'
                  : selectedStageKey === 'scheduled'
                    ? 'Article scheduled'
                    : isEditing
                      ? 'Article updated'
                      : 'Article saved'}
              </h3>
              <p className="text-xs text-slate-400 font-semibold">Redirecting you to the Editorial Dashboard...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Only a publish that failed is reported, because only that one
                needs the writer to do something. A successful dispatch, the
                repo it went to and the rebuild behind it are machinery, and
                saying so raised more questions than it answered. */}
            {isEditing && initialPost?.externalStatus === 'failed' && (
              <div className="rounded-2xl border border-[rgba(13,27,42,0.12)] bg-[#F5F0E8]/40 p-4 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/50">
                  This article did not publish
                </p>
                <p className="text-[11px] font-bold text-rose-600">
                  {initialPost.externalMessage}
                </p>

                <button
                  type="button"
                  onClick={retryPublish}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D1B2A] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#0D1B2A]/90 disabled:opacity-50 transition-colors"
                >
                  {retrying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  {retrying ? 'Sending…' : 'Retry publish'}
                </button>

                {retryResult && (
                  <p className="text-[10px] font-bold text-[#0D1B2A]/70">{retryResult}</p>
                )}
              </div>
            )}

            {/* Title & Slug */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Article Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Why Most Defendants Wait Too Long to Begin Mitigation"
                  value={title}
                  onChange={(e) => {
                    const newTitle = e.target.value
                    setTitle(newTitle)
                    if (isSyncedWithTitle) {
                      const slugified = newTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)+/g, '')
                      setSlug(slugified)
                    }
                  }}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    URL Slug
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSyncedWithTitle) {
                        // Re-sync with title immediately
                        const slugified = title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)+/g, '')
                        setSlug(slugified)
                        setIsSyncedWithTitle(true)
                      } else {
                        setIsSyncedWithTitle(false)
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                      isSyncedWithTitle
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/70'
                        : 'bg-[#F5F0E8]/40 text-[#0D1B2A]/50 border-[rgba(13,27,42,0.1)] hover:bg-[#F5F0E8]/70'
                    }`}
                    title={isSyncedWithTitle ? "Synced with Title (Click to customize)" : "Customized (Click to sync with Title)"}
                  >
                    {isSyncedWithTitle ? (
                      <>
                        <Link2 className="w-3 h-3 text-emerald-600" />
                        <span>Synced</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 text-[#0D1B2A]/40 hover:rotate-180 transition-transform duration-300" />
                        <span>Custom (Sync)</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="why-defendants-wait-too-long-mitigation"
                  value={slug}
                  onChange={(e) => {
                    setIsSyncedWithTitle(false)
                    const cleanSlug = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9-]/g, '')
                    setSlug(cleanSlug)
                  }}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm"
                />
              </div>
            </div>

            {/* Target Role & Department / Readtime */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">Target Focus / Category</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Pre-Sentence, Post-Sentence, RDAP"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">Author</label>
                <select
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm cursor-pointer"
                >
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name} ({author.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">Initial Pipeline Stage</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm cursor-pointer"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Only meaningful in the Scheduled stage, so it appears with it. */}
            {isScheduledStage && (
              <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4 space-y-2">
                <label
                  htmlFor="scheduled-for"
                  className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/50 flex items-center gap-1.5"
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Publish On
                </label>
                <input
                  id="scheduled-for"
                  type="datetime-local"
                  required
                  min={earliestSchedule}
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-bold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm"
                />
                <p className="text-[10px] text-[#0D1B2A]/50 font-semibold leading-relaxed">
                  {scheduledFor
                    ? `Publishes by itself at ${new Date(scheduledFor).toLocaleString()} (your local time). Change the stage to cancel.`
                    : 'Pick the date and time this article should go live.'}
                </p>
                {isEditing && initialPost?.scheduleStatus && (
                  <p
                    className={`text-[10px] font-bold ${
                      initialPost.scheduleStatus === 'failed' ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {initialPost.scheduleStatus} — {initialPost.scheduleMessage}
                  </p>
                )}
              </div>
            )}

            {/* Cover Image Tabbed Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Cover Image (Optional)
                </label>
                <div className="flex bg-[#F5F0E8]/40 p-0.5 rounded-lg border border-[rgba(13,27,42,0.1)]">
                  <button
                    type="button"
                    onClick={() => setImageSource('upload')}
                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                      imageSource === 'upload'
                        ? 'bg-white text-[#C9A84C] shadow-sm'
                        : 'text-[#0D1B2A]/50 hover:text-[#0D1B2A]'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource('url')}
                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                      imageSource === 'url'
                        ? 'bg-white text-[#C9A84C] shadow-sm'
                        : 'text-[#0D1B2A]/50 hover:text-[#0D1B2A]'
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {imageSource === 'upload' ? (
                <div className="space-y-2">
                  <label
                    htmlFor="cover-image-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-[rgba(13,27,42,0.15)] hover:border-[#C9A84C] bg-[#F5F0E8]/20 hover:bg-[#C9A84C]/5 transition-all duration-300 rounded-2xl p-6 text-center cursor-pointer group shadow-sm min-h-32"
                  >
                    <input
                      id="cover-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
                        <span className="text-xs font-bold text-[#0D1B2A]/70">Uploading your image...</span>
                      </div>
                    ) : coverImageUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <Check className="w-8 h-8 text-emerald-600" />
                        <span className="text-xs font-bold text-[#0D1B2A]/85">Image Uploaded Successfully!</span>
                        <span className="text-[10px] text-[#0D1B2A]/40 font-semibold truncate max-w-xs">{coverImageUrl}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-slate-100 group-hover:bg-[#C9A84C]/10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-[#C9A84C] transition-all">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-[#0D1B2A]/60">Click to choose image or drag & drop</span>
                        <span className="text-[9px] text-[#0D1B2A]/35 font-semibold">Supports PNG, JPG, WEBP (Max 5MB)</span>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={coverImageUrl}
                  onChange={(e) => {
                    setCoverImageUrl(e.target.value)
                    setUploadedMediaId(null)
                  }}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm"
                />
              )}

              {coverImageUrl && (
                <div className="relative group w-full max-h-80 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner mt-2 bg-slate-50/50 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cleanImageUrl(coverImageUrl).startsWith('/') ? `${process.env.NEXT_PUBLIC_SERVER_URL || ''}${cleanImageUrl(coverImageUrl)}` : cleanImageUrl(coverImageUrl)}
                    alt="Cover preview"
                    className="max-h-80 w-auto object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {uploadedMediaId && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImageUrl('')
                        setUploadedMediaId(null)
                      }}
                      className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Short Excerpt */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">Brief Article Excerpt</label>
              <textarea 
                required
                rows={2}
                placeholder="Give a short summary of this article to display in the archive..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm resize-none"
              />
            </div>

            {/* Content Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">Article Content Body</label>
                <span className="text-[10px] text-[#0D1B2A]/50 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#C9A84C]" /> Estimated {readTime}
                </span>
              </div>

              {/* Toolbar and textarea live in one bordered box: a gap between them
                  reads as two separate controls, and the focus ring has to cover both. */}
              <div className="rounded-xl border border-[rgba(13,27,42,0.12)] bg-[#F5F0E8]/30 shadow-sm overflow-hidden transition-all focus-within:border-[#C9A84C] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#C9A84C]/15">
                {/* justify-between spreads the groups over the full width instead of
                    stacking them on the left and wrapping while the right half is empty. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200/80">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => applyFormatting('bold')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Bold (**bold**)"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('italic')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Italic (*italic*)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('underline')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Underline (__underline__)"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('code')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Inline Code (`code`)"
                    >
                      <Code className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('strike')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Strikethrough (~~text~~)"
                    >
                      <Strikethrough className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => applyFormatting('h1')}
                      className="px-2 py-1 text-[10px] font-extrabold hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Heading 1 (# Heading)"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('h2')}
                      className="px-2 py-1 text-[10px] font-extrabold hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Heading 2 (## Heading)"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('h3')}
                      className="px-2 py-1 text-[10px] font-extrabold hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Heading 3 (### Heading)"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('quote')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Blockquote (> Quote)"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>
                    <span aria-hidden className="w-px h-5 bg-slate-200 shrink-0 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting('link')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Insert Follow Link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('link-nofollow')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-500 rounded-lg transition-colors cursor-pointer"
                      title="Insert Nofollow Link (Crawler Ignore)"
                    >
                      <Link2 className="w-3.5 h-3.5 text-rose-500/80" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => applyFormatting('ul')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Bullet List (- Item)"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('ol')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Numbered List (1. Item)"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <span aria-hidden className="w-px h-5 bg-slate-200 shrink-0 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting('table')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Insert Table"
                    >
                      <Table className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('codeblock')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Code Block (```)"
                    >
                      <SquareCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('image')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Insert Image by URL"
                    >
                      <ImageIconLucide className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('divider')}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Horizontal Rule (---)"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span aria-hidden className="w-px h-5 bg-slate-200 shrink-0 mx-1" />
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => applyFormatting('takeaways')}
                        className="p-1.5 hover:bg-[#C9A84C]/20 text-[#0D1B2A] rounded-lg transition-colors cursor-pointer"
                        title="Key Takeaways box (## Key Takeaways + bullets)"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('callout-key')}
                        className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                        title="Key point callout (:::key)"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('callout-tip')}
                        className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                        title="Tip callout (:::tip)"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('callout-warning')}
                        className="p-1.5 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                        title="Warning callout (:::warning)"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('faq')}
                        className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                        title="FAQ section (## FAQ + ### questions)"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span aria-hidden className="w-px h-5 bg-slate-200 shrink-0 mx-1" />
                    <button
                      type="button"
                      onClick={triggerFileUpload}
                      className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Upload & Insert File"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                    {isMediaUploading && (
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 ml-2 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading file...
                      </span>
                    )}
                  </div>

                  {/* Second child of the justify-between row, so both of these sit at
                      the far right instead of crowding the formatting groups. Each
                      appears only when the body actually has something for it to do. */}
                  <div className="flex items-center gap-0.5">
                  {pendingImport.consumed.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setContent(applyDocImport(content))}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0D1B2A] hover:bg-[#C9A84C]/20 rounded-lg transition-colors cursor-pointer"
                      title={`Moves the document's ${pendingImport.consumed.join(', ')} out of the body and into the fields above. A field you have already filled in is left alone.`}
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#C9A84C]" />
                      Read SEO block
                    </button>
                  )}
                  {pendingImages.length > 0 && (
                    <button
                      type="button"
                      onClick={generateImages}
                      disabled={isGeneratingImages}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0D1B2A] hover:bg-[#C9A84C]/20 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      title={pendingImages
                        .map((p) => `${p.label}${p.placement ? ` (${p.placement})` : ''}: ${p.alt}`)
                        .join('\n')}
                    >
                      {isGeneratingImages ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating {imageProgress ? `${imageProgress.done + 1}/${imageProgress.total}` : ''}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
                          Generate {pendingImages.length} image{pendingImages.length === 1 ? '' : 's'}
                        </>
                      )}
                    </button>
                  )}
                  </div>
                </div>
                <textarea
                  ref={contentRef}
                  required
                  rows={10}
                  placeholder="Write your beautiful markdown-formatted post here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handleContentPaste}
                  className="w-full bg-transparent border-0 text-xs font-semibold p-4 outline-none focus:ring-0 text-[#0D1B2A] leading-relaxed resize-y block"
                />
              </div>

              <input
                type="file"
                ref={mediaInputRef}
                onChange={handleMediaUpload}
                className="hidden"
                accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              
            </div>

            {/* SEO & meta tags — the fallback surface, for an article whose
                body carries no SEO block.

                Rendered only then. When the block is there it is the thing the
                writer edits, and a panel showing the same seven values would
                be a second place to change them that could disagree with the
                first. Collapsed by default even here: every field falls back,
                so most articles never need it opened.

                Deleting the block from the body brings this back, holding
                whatever the block last said. */}
            {!seoBlock.present && (
            <div className="rounded-xl border border-[rgba(13,27,42,0.12)] bg-[#F5F0E8]/30 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setSeoOpen((open) => !open)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F5F0E8]/60 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/60">
                  <Search className="w-3.5 h-3.5 text-[#C9A84C]" />
                  SEO &amp; meta tags
                  {seoFilledCount > 0 && (
                    <span className="normal-case tracking-normal font-bold text-[9px] text-[#C9A84C]">
                      {seoFilledCount} set
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#0D1B2A]/40 transition-transform ${seoOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {seoOpen && (
                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[rgba(13,27,42,0.08)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Meta title
                        <span className="ml-2 normal-case tracking-normal font-semibold text-[#0D1B2A]/35">
                          {metaTitle.trim().length}/60
                        </span>
                      </label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder={title || 'Falls back to the article title'}
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Target keyword
                      </label>
                      <input
                        type="text"
                        value={targetKeyword}
                        onChange={(e) => setTargetKeyword(e.target.value)}
                        placeholder="cost to paint kitchen cabinets"
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                      Meta description
                      <span className="ml-2 normal-case tracking-normal font-semibold text-[#0D1B2A]/35">
                        {metaDescription.trim().length}/160
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder={excerpt || 'Falls back to the excerpt'}
                      className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Meta keywords
                      </label>
                      <input
                        type="text"
                        value={metaKeywords}
                        onChange={(e) => setMetaKeywords(e.target.value)}
                        placeholder="cabinet painting, kitchen cabinets, cost"
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Canonical URL
                      </label>
                      <input
                        type="text"
                        value={canonicalUrl}
                        onChange={(e) => setCanonicalUrl(e.target.value)}
                        placeholder={`${targetSite.baseUrl || ''}${targetSite.blogPath}/${slug || 'your-slug'}`}
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Cover image alt text
                      </label>
                      <input
                        type="text"
                        value={coverImageAlt}
                        onChange={(e) => setCoverImageAlt(e.target.value)}
                        placeholder="Sprayed white cabinet doors drying on a rack"
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/40">
                        Social share image URL
                      </label>
                      <input
                        type="text"
                        value={ogImageUrl}
                        onChange={(e) => setOgImageUrl(e.target.value)}
                        placeholder={coverImageUrl || 'Falls back to the cover image'}
                        className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none transition-all text-[#0D1B2A]"
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E5C567] text-[#0D1B2A] font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-full shadow-md shadow-[#C9A84C]/25 transition-all active:scale-[0.98] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isEditing ? 'Saving changes...' : 'Saving to CMS...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isEditing ? 'Save Changes' : 'Submit & Queue Blog'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
