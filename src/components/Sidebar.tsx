'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  KanbanSquare, 
  PenTool, 
  BarChart3, 
  Users2
} from 'lucide-react'
import { SiteSwitcher } from './SiteSwitcher'

export const Sidebar: React.FC = () => {
  const pathname = usePathname()

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Pipeline Board', href: '/kanban', icon: KanbanSquare },
    { name: 'Write New Blog', href: '/editor', icon: PenTool },
    { name: 'Manage Authors', href: '/authors', icon: Users2 },
    { name: 'Performance Stats', href: '/analytics', icon: BarChart3 },
  ]

  return (
    <aside className="w-64 bg-[#0D1B2A] text-white flex flex-col fixed inset-y-0 left-0 border-r border-white/5 z-30 shadow-lg font-body">
      {/* Branding Logo */}
      <div className="h-20 flex items-center px-6 border-b border-white/5 gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="flex flex-col text-left">
            <span className="text-[15px] font-bold tracking-tight leading-none text-white font-headline">
              White Collar
            </span>
            <span className="text-[10px] font-bold tracking-[2px] leading-none text-[#C9A84C] mt-1 font-body">
              ADVICE
            </span>
          </div>
          <div className="h-5 w-[1px] bg-white/20 self-center"></div>
          <span className="text-[9px] font-bold text-[#C9A84C] tracking-wider uppercase">
            CMS
          </span>
        </Link>
      </div>

      {/* Active website selector — scopes every screen below it */}
      <SiteSwitcher />

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 ${
                isActive
                  ? 'bg-[#C9A84C] text-[#0D1B2A] shadow-lg shadow-[#C9A84C]/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0D1B2A]' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={async () => {
            await fetch('/api/users/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] transition-all duration-200 border border-white/10 hover:border-[#C9A84C]/30 bg-white/5"
        >
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

