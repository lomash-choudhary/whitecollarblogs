'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.errors?.[0]?.message || 'Invalid email or password')
      }

      // Successful login creates the HTTP-only cookie automatically via Payload
      router.push('/dashboard')
      router.refresh() // Force refresh to update server components layout check
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 text-left font-body">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 md:p-10 flex flex-col gap-8 relative overflow-hidden rounded-3xl shadow-sm border border-[rgba(13,27,42,0.1)]">
          {/* Top accent highlight */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#C9A84C]"></div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-[#C9A84C]/8 rounded-full mx-auto flex items-center justify-center text-[#C9A84C] mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            
            {/* Stacked Logo */}
            <div className="flex flex-col text-center justify-center items-center select-none">
              <span className="text-[20px] font-bold tracking-tight leading-none text-[#0D1B2A] font-headline">
                White Collar
              </span>
              <span className="text-[12px] font-bold tracking-[2px] leading-none text-[#C9A84C] mt-1 uppercase">
                Advice
              </span>
            </div>

            <h1 className="text-lg font-bold text-[#0D1B2A] tracking-tight font-headline">CMS Portal</h1>
            <p className="text-xs text-[#0D1B2A]/40 font-semibold">Password protected administrative archive portal.</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3 rounded-2xl text-center font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-[#0D1B2A]/40 uppercase tracking-widest pl-1">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] text-xs rounded-full pl-10 pr-4 py-3 outline-none focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 transition-all duration-300 text-[#0D1B2A] font-semibold placeholder:text-[#0D1B2A]/30"
                  placeholder="admin@whitecollar.com"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-[#0D1B2A]/40 uppercase tracking-widest pl-1">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F5F0E8]/30 border border-[rgba(13,27,42,0.12)] text-xs rounded-full pl-10 pr-4 py-3 outline-none focus:border-[#C9A84C] focus:bg-white focus:ring-2 focus:ring-[#C9A84C]/15 transition-all duration-300 text-[#0D1B2A] font-semibold placeholder:text-[#0D1B2A]/30"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#C9A84C] hover:bg-[#E5C567] disabled:bg-[#C9A84C]/70 text-[#0D1B2A] font-bold text-xs uppercase tracking-widest px-5 py-3.5 rounded-full transition-all duration-300 active:scale-[0.98] hover:scale-[1.02] shadow-lg shadow-[#C9A84C]/25 flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Secure Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

