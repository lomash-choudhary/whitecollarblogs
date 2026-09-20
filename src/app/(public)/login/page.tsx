'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'

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

          <div className="text-center space-y-4">
            {/* The wordmark in `logo.png` is white with a transparent
                background, so it is invisible on the card's white panel. The
                navy block is not decoration — it is what makes the brand
                readable, and it is the same navy the rest of the app uses. */}
            <div className="bg-[#0D1B2A] rounded-2xl px-6 py-5 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Homeowner Marketers"
                width={1030}
                height={345}
                priority
                className="w-[190px] h-auto"
              />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-[#0D1B2A] tracking-tight font-headline">Blog CMS</h1>
              <p className="text-xs text-[#0D1B2A]/40 font-semibold">Sign in to write, schedule and publish articles.</p>
            </div>
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
                  placeholder="you@homeownermarketers.com"
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

