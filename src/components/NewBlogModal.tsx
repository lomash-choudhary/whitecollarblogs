'use client'

import React, { useState } from 'react'
import { FileUp, Loader2, Sparkles, X } from 'lucide-react'

/**
 * Which half of the import is running. The two are separate because they fail
 * separately and take wildly different amounts of time: a conversion is one
 * request measured in hundreds of milliseconds, image generation is one request
 * *per tag* and each of those is tens of seconds. A single "working" spinner
 * over both left the writer watching a still screen for a minute with nothing
 * to say the thing was still alive.
 */
export type ImportPhase = 'idle' | 'converting' | 'images'

interface NewBlogModalProps {
  phase: ImportPhase
  /** How far image generation has got, once it is the phase that is running. */
  imageProgress: { done: number; total: number } | null
  /** The one failure a writer can act on: the file was not usable. */
  error: string
  onSelectFile: (file: File) => void
  onClose: () => void
}

const ACCEPT =
  '.docx,.md,.markdown,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain'

/**
 * The first thing a writer sees after *New Blog*: drop the SEO team's document
 * in, or close it and write the article by hand.
 *
 * It is the only way a document gets into the editor now — the toolbar button
 * that used to do it is gone, because an upload *is* how an article starts and
 * a control that replaces the whole body sat one slip away from the formatting
 * buttons. Closing is a first-class answer, not a dismissal: it lands on the
 * same blank editor the toolbar button used to sit above.
 */
export const NewBlogModal: React.FC<NewBlogModalProps> = ({
  phase,
  imageProgress,
  error,
  onSelectFile,
  onClose,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const busy = phase !== 'idle'

  // Escape closes, but only while nothing is running: a conversion or a
  // generation run is work the writer is waiting on, and unmounting the panel
  // mid-flight would leave it finishing into a screen that no longer reports it.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const take = (file: File | undefined) => {
    if (!file || busy) return
    onSelectFile(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 font-body"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-blog-modal-title"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-[rgba(13,27,42,0.1)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Same brand accent the editor card carries, so the two read as one screen. */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-[#C9A84C]" />

        <div className="px-6 pt-7 pb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3
              id="new-blog-modal-title"
              className="text-base font-bold text-[#0D1B2A] tracking-tight font-headline"
            >
              Start a new article
            </h3>
            <p className="text-[11px] text-[#0D1B2A]/50 font-semibold">
              Upload the document, or close this and write it yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matches the header's `pt-7` now that the footer is gone. */}
        <div className="px-6 pb-7">
          {busy ? (
            <div className="rounded-2xl border border-[rgba(13,27,42,0.12)] bg-[#F5F0E8]/40 px-6 py-10 flex flex-col items-center justify-center gap-3 text-center">
              {phase === 'converting' ? (
                <>
                  <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
                  <p className="text-xs font-bold text-[#0D1B2A]">Reading the document…</p>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
                    <Sparkles className="w-3.5 h-3.5 text-[#C9A84C] absolute -right-1.5 -top-1.5" />
                  </div>
                  <p className="text-xs font-bold text-[#0D1B2A]">
                    {imageProgress
                      ? `Generating image ${Math.min(imageProgress.done + 1, imageProgress.total)} of ${imageProgress.total}…`
                      : 'Generating images…'}
                  </p>
                  {imageProgress && imageProgress.total > 0 && (
                    <div className="w-48 h-1.5 rounded-full bg-[#0D1B2A]/10 overflow-hidden">
                      <div
                        className="h-full bg-[#C9A84C] transition-all duration-500"
                        style={{
                          width: `${Math.round((imageProgress.done / imageProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] font-semibold text-[#0D1B2A]/45">
                    This takes about half a minute per image.
                  </p>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                take(e.dataTransfer.files?.[0])
              }}
              className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center justify-center gap-3 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10'
                  : 'border-[rgba(13,27,42,0.15)] bg-[#F5F0E8]/40 hover:border-[#C9A84C] hover:bg-[#C9A84C]/5'
              }`}
            >
              <span className="w-11 h-11 rounded-full bg-[#C9A84C]/15 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-[#C9A84C]" />
              </span>
              <span className="text-xs font-bold text-[#0D1B2A]">
                Drop a .docx or .md file here, or click to choose one
              </span>
            </button>
          )}

          {error && (
            <p className="mt-4 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* One way out, not two. The × in the corner is the whole of it: a
            footer button beside it said the same thing twice and read as the
            second half of a choice the dialog does not have. */}
        <input
          type="file"
          ref={inputRef}
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Cleared straight away rather than in a `finally`: picking the
            // same file twice in a row fires no change event otherwise, so a
            // failed import could not be retried without choosing another file.
            e.target.value = ''
            take(file)
          }}
        />
      </div>
    </div>
  )
}
