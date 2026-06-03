'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search, Sparkles } from 'lucide-react'

export const Header: React.FC = () => {
  const pathname = usePathname()
  
  const getPageTitle = () => {
    if (pathname.includes('/blogs/')) {
      return 'Blog Details'
    }
    switch (pathname) {
      case '/dashboard':
        return 'Editorial Dashboard'
      case '/kanban':
        return 'Pipeline Kanban'
      case '/editor':
        return 'Content Editor'
      case '/blogs':
        return 'Blog Listing'
      case '/analytics':
        return 'Archive Stats'
      case '/authors':
        return 'Author Manager'
      default:
        return 'Dashboard'
    }
  }

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20 flex items-center justify-between px-8 shadow-[0_4px_20px_-2px_rgba(9,13,22,0.02)] font-body">
      {/* Page Title / Context */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-[#0D1B2A] tracking-tight font-headline">{getPageTitle()}</h1>
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#C9A84C]/8 text-[#C9A84C] border border-[#C9A84C]/15">
          <Sparkles className="w-3.5 h-3.5" /> Archive Active
        </span>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-5">
        {/* Search Input */}
        <div className="relative hidden lg:block w-64 group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-[#C9A84C] transition-colors" />
          </span>
          <input
            type="text"
            placeholder="Search archive articles..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 focus:border-[#C9A84C] transition-all text-[#0D1B2A] font-semibold"
          />
        </div>

        {/* Create Post Button */}
        <Link
          href="/editor"
          className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E5C567] text-[#0D1B2A] font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full shadow-md shadow-[#C9A84C]/10 hover:shadow-lg transition-all active:scale-[0.98] hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>New Blog</span>
        </Link>
      </div>
    </header>
  )
}

