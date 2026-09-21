'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { FileUp, Loader2, Sparkles, X, FileText, ArrowRight, CheckCircle2, Wand2, PenTool } from 'lucide-react'

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

/** Nothing to subscribe to: the value only differs between server and client. */
const SUBSCRIBE_NOTHING = () => () => {}

const ACCEPT =
  '.docx,.md,.markdown,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain'

/**
 * Premium modal for creating a new article — drop an SEO document or start blank.
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

  // Escape closes, but only while nothing is running
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // Lock body scroll when modal is active
  React.useEffect(() => {
    const { body } = document
    const overflow = body.style.overflow
    const paddingRight = body.style.paddingRight
    const gutter = window.innerWidth - document.documentElement.clientWidth

    body.style.overflow = 'hidden'
    if (gutter > 0) body.style.paddingRight = `${gutter}px`

    return () => {
      body.style.overflow = overflow
      body.style.paddingRight = paddingRight
    }
  }, [])

  const mounted = React.useSyncExternalStore(SUBSCRIBE_NOTHING, () => true, () => false)
  if (!mounted) return null

  const take = (file: File | undefined) => {
    if (!file || busy) return
    onSelectFile(file)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-body overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-blog-modal-title"
    >
      {/* Backdrop overlay */}
      <div
        onClick={() => !busy && onClose()}
        className="fixed inset-0 bg-[#0D1B2A]/65 backdrop-blur-xl transition-all duration-300"
      />

      {/* Main Dialog Box */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200/80 shadow-[0_25px_60px_-15px_rgba(13,27,42,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Shimmering Gold Top Border Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#C9A84C] via-[#F4E3B2] to-[#C9A84C]" />

        {/* Modal Header */}
        <div className="px-7 pt-8 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-black uppercase tracking-widest border border-[#C9A84C]/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create New Article</span>
            </div>
            <h3
              id="new-blog-modal-title"
              className="text-xl font-bold text-[#0D1B2A] tracking-tight font-headline"
            >
              Start Your New Article
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Import an existing Google Doc / Markdown draft or start writing from scratch.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-7 space-y-6 bg-slate-50/40">
          {busy ? (
            /* Processing State Card */
            <div className="rounded-2xl border border-[#C9A84C]/30 bg-gradient-to-b from-[#0D1B2A] to-[#162A3E] text-white p-8 flex flex-col items-center justify-center gap-5 text-center shadow-xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A84C]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#C9A84C]/10 rounded-full blur-3xl pointer-events-none" />

              {phase === 'converting' ? (
                <>
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-inner">
                      <FileText className="w-8 h-8 text-[#C9A84C] animate-pulse" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <Loader2 className="w-5 h-5 text-[#C9A84C] animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-base font-bold text-white tracking-wide">Reading & Converting Document</h4>
                    <p className="text-xs text-slate-300">
                      Extracting content structure, SEO metadata, and image prompts...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#C9A84C] to-[#E5C567] flex items-center justify-center text-[#0D1B2A] shadow-lg shadow-[#C9A84C]/30">
                      <Wand2 className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-base font-bold text-white tracking-wide">Generating AI Images</h4>
                    <p className="text-xs text-slate-300">
                      {imageProgress
                        ? `Processing image ${Math.min(imageProgress.done + 1, imageProgress.total)} of ${imageProgress.total}`
                        : 'Creating visual assets from article prompts...'}
                    </p>
                  </div>

                  {imageProgress && imageProgress.total > 0 && (
                    <div className="w-full max-w-xs space-y-1.5">
                      <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#C9A84C] to-[#F4E3B2] transition-all duration-500 shadow-[0_0_10px_rgba(201,168,76,0.8)]"
                          style={{
                            width: `${Math.round((imageProgress.done / imageProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>{Math.round((imageProgress.done / imageProgress.total) * 100)}% Completed</span>
                        <span>{imageProgress.done}/{imageProgress.total} Images</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] font-medium text-amber-200/70 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                    ⚡ High-resolution AI image rendering takes ~30s per image. Please keep this modal open.
                  </p>
                </>
              )}
            </div>
          ) : (
            /* Upload & Manual Actions */
            <div className="space-y-4">
              {/* Option 1: File Drop Zone */}
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
                className={`group w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-4 text-center transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isDragging
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 scale-[1.01] shadow-xl'
                    : 'border-slate-300/80 bg-white hover:border-[#C9A84C] hover:bg-gradient-to-b hover:from-white hover:to-[#C9A84C]/5 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0D1B2A] to-[#1E293B] text-[#C9A84C] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200 border border-white/10">
                  <FileUp className="w-7 h-7" />
                </div>

                <div className="space-y-1 max-w-sm">
                  <span className="text-sm font-bold text-[#0D1B2A] block group-hover:text-[#B29135] transition-colors">
                    Upload & Auto-Import Article
                  </span>
                  <span className="text-xs text-slate-500 font-medium block">
                    Drop your <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0D1B2A] font-mono text-[11px]">.docx</code> or <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0D1B2A] font-mono text-[11px]">.md</code> file here, or <span className="text-[#C9A84C] font-bold underline underline-offset-2">browse files</span>
                  </span>
                </div>

                {/* Features Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 w-full">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto-Extracts SEO
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Generates AI Images
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Google Docs Ready
                  </span>
                </div>
              </button>

              {/* Separator */}
              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Or start empty
                </span>
              </div>

              {/* Option 2: Write from Scratch */}
              <button
                type="button"
                onClick={onClose}
                className="w-full p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0D1B2A]/30 hover:bg-slate-50 flex items-center justify-between gap-4 transition-all duration-200 shadow-sm hover:shadow cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-[#0D1B2A] group-hover:text-white transition-colors">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0D1B2A]">Write From Scratch</h4>
                    <p className="text-[11px] text-slate-500">Open a clean markdown editor canvas</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-[#C9A84C] text-slate-400 group-hover:text-[#0D1B2A] flex items-center justify-center transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
              <p className="flex-1 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={inputRef}
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            take(file)
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
