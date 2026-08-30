/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Check, 
  Clock, 
  Image as ImageIcon,
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
  Paperclip
} from 'lucide-react'
import { cleanImageUrl } from '@/utils/cleanImageUrl'
import { lexicalToMarkdown } from '@/utils/lexicalToMarkdown'
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
  } | null
}


function parseInlineMarkdown(text: string): any[] {
  const nodes: any[] = []
  let i = 0
  const len = text.length
  
  let currentPlainText = ''
  
  const flushPlainText = () => {
    if (currentPlainText) {
      nodes.push({
        type: 'text',
        text: currentPlainText,
        version: 1,
        format: 0
      })
      currentPlainText = ''
    }
  }
  
  while (i < len) {
    // Check for inline code
    if (text[i] === '`') {
      const closingIdx = text.indexOf('`', i + 1)
      if (closingIdx !== -1) {
        flushPlainText()
        const codeText = text.substring(i + 1, closingIdx)
        nodes.push({
          type: 'text',
          text: codeText,
          version: 1,
          format: 16
        })
        i = closingIdx + 1
        continue
      }
    }

    // Check for Markdown Image: ![alt](url)
    if (text.startsWith('![', i)) {
      const closeBracketIdx = text.indexOf(']', i + 2)
      if (closeBracketIdx !== -1 && text[closeBracketIdx + 1] === '(') {
        const closeParenIdx = text.indexOf(')', closeBracketIdx + 2)
        if (closeParenIdx !== -1) {
          flushPlainText()
          const altText = text.substring(i + 2, closeBracketIdx)
          const url = text.substring(closeBracketIdx + 2, closeParenIdx).trim()
          
          const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg)$/) || altText.toLowerCase().startsWith('video')
          
          nodes.push({
            type: isVideo ? 'video' : 'image',
            version: 1,
            url,
            alt: altText
          })
          
          i = closeParenIdx + 1
          continue
        }
      }
    }

    // Check for Markdown Link: [text](url) or [text](url "title")
    if (text[i] === '[') {
      const closeBracketIdx = text.indexOf(']', i + 1)
      if (closeBracketIdx !== -1 && text[closeBracketIdx + 1] === '(') {
        const closeParenIdx = text.indexOf(')', closeBracketIdx + 2)
        if (closeParenIdx !== -1) {
          flushPlainText()
          const linkText = text.substring(i + 1, closeBracketIdx)
          const linkContent = text.substring(closeBracketIdx + 2, closeParenIdx).trim()
          
          let url = linkContent
          let title = ''
          
          const titleMatch = linkContent.match(/^([^\s]+)\s+["'](.*?)["']$/)
          if (titleMatch) {
            url = titleMatch[1]
            title = titleMatch[2].trim()
          }
          
          const isNofollow = title.toLowerCase() === 'nofollow'
          
          nodes.push({
            type: 'link',
            version: 1,
            fields: {
              url,
              newTab: url.startsWith('http'),
              rel: isNofollow ? ['nofollow'] : []
            },
            children: [
              {
                type: 'text',
                text: linkText,
                version: 1
              }
            ]
          })
          
          i = closeParenIdx + 1
          continue
        }
      }
    }
    
    // Check for bold and italic: ***text***
    if (text.startsWith('***', i)) {
      const closingIdx = text.indexOf('***', i + 3)
      if (closingIdx !== -1) {
        flushPlainText()
        const innerText = text.substring(i + 3, closingIdx)
        nodes.push({
          type: 'text',
          text: innerText,
          version: 1,
          format: 1 | 2
        })
        i = closingIdx + 3
        continue
      }
    }
    
    // Check for bold: **text**
    if (text.startsWith('**', i)) {
      const closingIdx = text.indexOf('**', i + 2)
      if (closingIdx !== -1) {
        flushPlainText()
        const innerText = text.substring(i + 2, closingIdx)
        nodes.push({
          type: 'text',
          text: innerText,
          version: 1,
          format: 1
        })
        i = closingIdx + 2
        continue
      }
    }

    // Check for underline: __text__
    if (text.startsWith('__', i)) {
      const closingIdx = text.indexOf('__', i + 2)
      if (closingIdx !== -1) {
        flushPlainText()
        const innerText = text.substring(i + 2, closingIdx)
        nodes.push({
          type: 'text',
          text: innerText,
          version: 1,
          format: 8
        })
        i = closingIdx + 2
        continue
      }
    }
    
    // Check for italic: *text*
    if (text[i] === '*') {
      const closingIdx = text.indexOf('*', i + 1)
      if (closingIdx !== -1) {
        flushPlainText()
        const innerText = text.substring(i + 1, closingIdx)
        nodes.push({
          type: 'text',
          text: innerText,
          version: 1,
          format: 2
        })
        i = closingIdx + 1
        continue
      }
    }
    
    // Just treat the current character as plain text if no formatting token matched
    currentPlainText += text[i]
    i++
  }
  
  flushPlainText()
  
  if (nodes.length === 0) {
    nodes.push({ type: 'text', text: '', version: 1, format: 0 })
  }
  
  return nodes
}

function markdownToLexical(markdown: string): any {
  if (!markdown) {
    return {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        children: []
      }
    }
  }

  const lines = markdown.split(/\r?\n/)
  const children: any[] = []
  
  let currentList: any = null

  const commitList = () => {
    if (currentList) {
      children.push(currentList)
      currentList = null
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === '') {
      commitList()
      i++
      continue
    }

    // Table (starts with | and has columns separated by |)
    if (trimmed.startsWith('|')) {
      commitList()
      const tableRows: any[] = []
      
      while (i < lines.length) {
        const nextLine = lines[i].trim()
        if (!nextLine.startsWith('|')) {
          break
        }
        
        // Skip separator line (like |---|---|)
        if (nextLine.match(/^\|(?:\s*:?-+:?\s*\|)+$/)) {
          i++
          continue
        }
        
        const cells = nextLine.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
        
        tableRows.push({
          type: 'tablerow',
          version: 1,
          children: cells.map(cellText => ({
            type: 'tablecell',
            version: 1,
            children: parseInlineMarkdown(cellText)
          }))
        })
        
        i++
      }
      
      if (tableRows.length > 0) {
        children.push({
          type: 'table',
          version: 1,
          children: tableRows
        })
      }
      continue
    }

    // Heading
    if (trimmed.startsWith('#')) {
      commitList()
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/)
      if (match) {
        const level = match[1].length
        const headingText = match[2]
        children.push({
          type: 'heading',
          tag: `h${level}`,
          format: '',
          indent: 0,
          version: 1,
          children: parseInlineMarkdown(headingText)
        })
        i++
        continue
      }
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      commitList()
      const quoteText = trimmed.replace(/^>\s*/, '')
      children.push({
        type: 'quote',
        format: '',
        indent: 0,
        version: 1,
        children: parseInlineMarkdown(quoteText)
      })
      i++
      continue
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listText = trimmed.substring(2)
      if (!currentList || currentList.listType !== 'bullet') {
        commitList()
        currentList = {
          type: 'list',
          listType: 'bullet',
          children: [],
          version: 1,
          format: '',
          indent: 0
        }
      }
      currentList.children.push({
        type: 'listitem',
        version: 1,
        children: parseInlineMarkdown(listText)
      })
      i++
      continue
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      const listText = orderedMatch[2]
      if (!currentList || currentList.listType !== 'number') {
        commitList()
        currentList = {
          type: 'list',
          listType: 'number',
          children: [],
          version: 1,
          format: '',
          indent: 0
        }
      }
      currentList.children.push({
        type: 'listitem',
        version: 1,
        children: parseInlineMarkdown(listText)
      })
      i++
      continue
    }

    // Paragraph
    commitList()
    let paraText = trimmed
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (
        nextLine === '' ||
        nextLine.startsWith('#') ||
        nextLine.startsWith('>') ||
        nextLine.startsWith('- ') ||
        nextLine.startsWith('* ') ||
        nextLine.match(/^(\d+)\.\s+/)
      ) {
        break
      }
      paraText += ' ' + nextLine
      i++
    }
    
    children.push({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      children: parseInlineMarkdown(paraText)
    })
    
    i++
  }

  commitList()

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children
    }
  }
}

export const BlogEditor: React.FC<BlogEditorProps> = ({ authors, stages, initialPost }) => {
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

  const [targetRole, setTargetRole] = useState(initialPost?.targetRole || 'Software Engineer')
  
  // Derive reading time dynamically from content length to avoid useEffect state updates
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.ceil(words / 200))
  const readTime = `${minutes} min read`

  const [selectedAuthor, setSelectedAuthor] = useState(initialPost?.author || authors[0]?.id || '')
  const [selectedStage, setSelectedStage] = useState(initialPost?.stage || stages[stages.length - 1]?.id || '')
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

  const { sites, activeSite } = useSite()
  // An existing post keeps the website it was created for; a new post targets
  // whichever website is selected in the sidebar.
  const [siteKey, setSiteKey] = useState(initialPost?.site || activeSite.key)
  const targetSite = sites.find((s) => s.key === siteKey) || activeSite

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [publishNote, setPublishNote] = useState<string | null>(null)

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
            {/* Destination website — decides where "Published" actually sends this post */}
            <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4 space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B2A]/50">
                Publish To Website
              </label>
              <select
                value={siteKey}
                onChange={(e) => setSiteKey(e.target.value)}
                disabled={isEditing}
                className="w-full bg-white border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-bold px-4 py-3 rounded-xl outline-none transition-all text-[#0D1B2A] shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sites.map((site) => (
                  <option key={site.key} value={site.key}>
                    {site.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#0D1B2A]/50 font-semibold leading-relaxed">
                {isEditing
                  ? 'A post stays on the website it was created for.'
                  : targetSite.target === 'github'
                    ? `Choosing the "Published" stage pushes this article to ${targetSite.name} as a markdown file, refreshes its sitemap and blog listing, and redeploys that site.`
                    : 'This article will be served straight from this CMS.'}
              </p>
              {isEditing && initialPost?.externalStatus && (
                <p
                  className={`text-[10px] font-bold ${
                    initialPost.externalStatus === 'failed' ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  Last publish: {initialPost.externalStatus} — {initialPost.externalMessage}
                </p>
              )}
            </div>

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

              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 border border-slate-200/80 rounded-t-xl border-b-0">
                <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
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
                </div>

                <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
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
                    onClick={() => applyFormatting('quote')}
                    className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Blockquote (> Quote)"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('link')}
                    className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5"
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
                  <button
                    type="button"
                    onClick={() => applyFormatting('table')}
                    className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5"
                    title="Insert Table"
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={triggerFileUpload}
                    className="p-1.5 hover:bg-slate-200/70 text-slate-600 rounded-lg transition-colors cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5"
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

              <input
                type="file"
                ref={mediaInputRef}
                onChange={handleMediaUpload}
                className="hidden"
                accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />

              <textarea 
                ref={contentRef}
                required
                rows={10}
                placeholder="Write your beautiful markdown-formatted post here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 text-xs font-semibold p-4 rounded-b-xl outline-none transition-all text-[#0D1B2A] shadow-sm leading-relaxed border-t-0"
              />
              
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] text-[#0D1B2A]/40 font-semibold">
                  Supports markdown formatting (*italic*, **bold**, __underline__, `# heading`, &gt; quote).
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
