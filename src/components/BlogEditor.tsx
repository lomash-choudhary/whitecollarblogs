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
  HelpCircle
} from 'lucide-react'
import { cleanImageUrl } from '@/utils/cleanImageUrl'
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
  const [content, setContent] = useState(initialPost ? lexicalToMarkdown(initialPost.content) : '')
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', file.name)
      
      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      
      if (!res.ok) {
        throw new Error('Upload failed')
      }
      
      const data = await res.json()
      if (data.doc?.url) {
        const fileUrl = data.doc.url
        const fileName = data.doc.filename || file.name
        const mimeType = file.type || ''
        
        let markdownInsert = ''
        if (mimeType.startsWith('image/')) {
          markdownInsert = `\n![${fileName}](${fileUrl})\n`
        } else if (mimeType.startsWith('video/')) {
          markdownInsert = `\n![video](${fileUrl})\n`
        } else {
          markdownInsert = `\n[📄 Download ${fileName}](${fileUrl})\n`
        }
        
        const textarea = contentRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const text = textarea.value
          const newValue = text.substring(0, start) + markdownInsert + text.substring(end)
          setContent(newValue)
          
          setTimeout(() => {
             textarea.focus()
             const newCursorPos = start + markdownInsert.length
             textarea.setSelectionRange(newCursorPos, newCursorPos)
          }, 0)
        }
      }
    } catch (err) {
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

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selectedText = text.substring(start, end)
    
    let replacement = ''
    let cursorOffset = 0

    switch (formatType) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`
        cursorOffset = selectedText ? 0 : 1
        break
      case 'underline':
        replacement = `__${selectedText || 'underlined text'}__`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'code':
        replacement = `\`${selectedText || 'code block'}\``
        cursorOffset = selectedText ? 0 : 1
        break
      case 'h1':
        replacement = `\n# ${selectedText || 'Heading 1'}\n`
        break
      case 'h2':
        replacement = `\n## ${selectedText || 'Heading 2'}\n`
        break
      case 'quote':
        replacement = `\n> ${selectedText || 'Quote'}\n`
        break
      case 'ul':
        replacement = `\n- ${selectedText || 'List item'}\n`
        break
      case 'ol':
        replacement = `\n1. ${selectedText || 'List item'}\n`
        break
      case 'table':
        replacement = selectedText 
          ? `\n| ${selectedText} | Column 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n`
          : `\n| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |\n`
        break
      case 'link':
        replacement = `[${selectedText || 'link text'}](https://example.com)`
        cursorOffset = selectedText ? 0 : 21
        break
      case 'link-nofollow':
        replacement = `[${selectedText || 'link text'}](https://example.com "nofollow")`
        cursorOffset = selectedText ? 0 : 32
        break
      case 'strike':
        replacement = `~~${selectedText || 'struck text'}~~`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'h3':
        replacement = `\n### ${selectedText || 'Heading 3'}\n`
        break
      case 'codeblock':
        // Fenced, so the whole block survives the save. An indented block or a
        // bare newline would be read back as an ordinary paragraph.
        replacement = `\n\`\`\`\n${selectedText || 'code here'}\n\`\`\`\n`
        break
      case 'divider':
        replacement = `\n---\n`
        break
      case 'image':
        replacement = `\n![${selectedText || 'describe the image'}](https://example.com/image.jpg "optional caption")\n`
        break
      case 'takeaways':
        // The heading is the syntax: every site turns "Key Takeaways" plus the
        // bullets under it into its own styled box.
        replacement = `\n## Key Takeaways\n\n- ${selectedText || 'First takeaway'}\n- Second takeaway\n- Third takeaway\n`
        break
      case 'callout-note':
        replacement = `\n:::note\n${selectedText || 'Something worth knowing.'}\n:::\n`
        break
      case 'callout-tip':
        replacement = `\n:::tip\n${selectedText || 'A helpful tip.'}\n:::\n`
        break
      case 'callout-warning':
        replacement = `\n:::warning\n${selectedText || 'Something to watch out for.'}\n:::\n`
        break
      case 'callout-key':
        replacement = `\n:::key ${selectedText || 'Key point'}\nWhy it matters.\n:::\n`
        break
      case 'faq':
        replacement = `\n## FAQ\n\n### ${selectedText || 'First question?'}\n\nThe answer.\n\n### Second question?\n\nThe answer.\n`
        break
      default:
        return
    }

    const newValue = text.substring(0, start) + replacement + text.substring(end)
    setContent(newValue)

    // Reset selection/focus
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + replacement.length - cursorOffset
      textarea.setSelectionRange(newCursorPos, newCursorPos)
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
  const isScheduledStage =
    stages.find((st) => String(st.id) === String(selectedStage))?.key === 'scheduled'
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', `Cover for ${title || 'blog'}`)

      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.errors?.[0]?.message || 'Upload failed. Make sure you are logged in.')
      }

      const data = await res.json()
      if (data.doc?.id) {
        setUploadedMediaId(data.doc.id)
        setCoverImageUrl(data.doc.url)
      } else {
        throw new Error('Invalid response from media server.')
      }
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
  const [publishNote, setPublishNote] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryResult, setRetryResult] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const lexicalContent = markdownToLexical(content)

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
          author: /^\d+$/.test(String(selectedAuthor)) ? Number(selectedAuthor) : selectedAuthor,
          stage: /^\d+$/.test(String(selectedStage)) ? Number(selectedStage) : selectedStage,
          scheduledFor:
            isScheduledStage && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          site: siteKey,
          coverImageUrl: cleanImageUrl(coverImageUrl) || undefined,
          coverImage: uploadedMediaId || undefined,
          ...(isEditing ? {} : { views: 0, likes: 0, publishDate: new Date().toISOString() }),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Failed to submit article')
      }

      const saved = await response.json().catch(() => null)
      const savedDoc = saved?.doc || saved
      const isPublishedStage =
        stages.find((st) => String(st.id) === String(selectedStage))?.key === 'published'

      setSuccess(true)

      if (targetSite.target === 'github' && isPublishedStage) {
        setPublishNote(
          savedDoc?.externalMessage ||
            `Sent to ${targetSite.name}. The site rebuilds in a couple of minutes.`,
        )
      }

      setTimeout(
        () => {
          router.push('/dashboard')
          router.refresh()
        },
        targetSite.target === 'github' && isPublishedStage ? 3500 : 1500,
      )
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
              <h3 className="text-sm font-bold text-slate-800">
                {isEditing ? 'Article Updated Successfully!' : 'Article Created Successfully!'}
              </h3>
              {publishNote && (
                <p className="text-xs text-emerald-700 font-bold max-w-md mx-auto">{publishNote}</p>
              )}
              <p className="text-xs text-slate-400 font-semibold">Redirecting you to the Editorial Dashboard...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* No website picker here — the sidebar switcher decides the
                destination. This only reports how the last publish went. */}
            {isEditing && initialPost?.externalStatus && (
              <div className="rounded-2xl border border-[rgba(13,27,42,0.12)] bg-[#F5F0E8]/40 p-4 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/50">
                  {targetSite.name} publish status
                </p>
                <p
                  className={`text-[11px] font-bold ${
                    initialPost.externalStatus === 'failed' ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {initialPost.externalStatus} — {initialPost.externalMessage}
                </p>

                {initialPost.externalStatus === 'failed' && (
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
                )}

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
                </div>
                <textarea
                  ref={contentRef}
                  required
                  rows={10}
                  placeholder="Write your beautiful markdown-formatted post here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
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
              
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] text-[#0D1B2A]/40 font-semibold">
                  Markdown: **bold** *italic* __underline__ ~~strike~~ `code` &bull; # heading &bull; &gt; quote &bull; - list &bull; | table | &bull; ``` code block &bull; --- rule &bull; ![alt](url) &bull; ## Key Takeaways &bull; :::tip :::warning :::key &bull; ## FAQ. Every one of these renders on all four websites.
                </span>
              </div>
            </div>

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
