'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface ShareBarProps {
  url: string
  title: string
}

export default function ShareBar({ url, title }: ShareBarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const shareText = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)

  return (
    <div className="flex xl:flex-col gap-3 justify-center items-center py-4 xl:py-0">
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 rounded-full bg-white border border-[rgba(13,27,42,0.1)] text-[#0D1B2A]/50 hover:text-white hover:bg-[#1877F2] hover:border-[#1877F2] flex items-center justify-center transition-all duration-300 shadow-sm"
        title="Share on Facebook"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 rounded-full bg-white border border-[rgba(13,27,42,0.1)] text-[#0D1B2A]/50 hover:text-white hover:bg-black hover:border-black flex items-center justify-center transition-all duration-300 shadow-sm"
        title="Share on X"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 rounded-full bg-white border border-[rgba(13,27,42,0.1)] text-[#0D1B2A]/50 hover:text-white hover:bg-[#0A66C2] hover:border-[#0A66C2] flex items-center justify-center transition-all duration-300 shadow-sm"
        title="Share on LinkedIn"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
      </a>
      <button
        onClick={handleCopy}
        className="w-10 h-10 rounded-full bg-white border border-[rgba(13,27,42,0.1)] text-[#0D1B2A]/50 hover:text-white hover:bg-[#C9A84C] hover:border-[#C9A84C] flex items-center justify-center transition-all duration-300 shadow-sm cursor-pointer relative group"
        title="Copy Link"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        {copied && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0D1B2A] text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap z-50">
            Copied!
          </span>
        )}
      </button>
    </div>
  )
}
