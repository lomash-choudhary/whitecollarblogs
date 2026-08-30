'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { useSite } from '@/context/SiteContext'

export const SiteSwitcher: React.FC = () => {
  const { sites, activeSite, setActiveSite } = useSite()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={wrapperRef} className="px-5 py-5 border-b border-white/5 relative">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-bold tracking-[2px] uppercase text-slate-400">Website</span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#C9A84C]/40 transition-all duration-200 text-left"
      >
        <span className="text-sm font-bold text-white truncate">{activeSite.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <p className="text-[11px] text-slate-500 mt-2 leading-snug">{activeSite.description}</p>

      {open && (
        <div
          role="listbox"
          className="absolute left-5 right-5 mt-2 z-40 rounded-2xl bg-[#152438] border border-white/10 shadow-2xl overflow-hidden"
        >
          {sites.map((site) => {
            const isActive = site.key === activeSite.key
            return (
              <button
                key={site.key}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setActiveSite(site.key)
                  setOpen(false)
                }}
                className={`w-full flex items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-[#C9A84C]/15' : 'hover:bg-white/5'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-xs font-bold truncate ${isActive ? 'text-[#C9A84C]' : 'text-slate-200'}`}>
                    {site.name}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    {site.target === 'local' ? 'Hosted on this CMS' : 'Published via GitHub'}
                  </span>
                </span>
                {isActive && <Check className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
