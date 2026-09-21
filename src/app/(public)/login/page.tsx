'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto font-body">
      {/* Main Card Container */}
      <div className="bg-[#0D1B2A] border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl overflow-hidden relative">
        
        {/* Top Accent Gold Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-[#C9A84C]" />

        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9A84C]" />
            <span>Blog CMS Portal</span>
          </div>

          {/* Logo */}
          <div className="py-2 px-4 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Homeowner Marketers"
              width={1030}
              height={345}
              priority
              className="w-[200px] sm:w-[220px] h-auto"
            />
          </div>

          {/* Subtitle */}
          <p className="text-xs text-slate-400 font-medium max-w-[280px]">
            Sign in to manage, write & publish high-impact articles.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block pl-1">
              Email Address
            </label>
            <div className="relative group/input">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 text-white text-xs rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-[#C9A84C] focus:bg-slate-900 transition-colors duration-200 font-medium placeholder:text-slate-500"
                placeholder="name@homeownermarketers.com"
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-[#C9A84C] transition-colors duration-200" />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block pl-1">
              Password
            </label>
            <div className="relative group/input">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 text-white text-xs rounded-xl pl-11 pr-11 py-3.5 outline-none focus:border-[#C9A84C] focus:bg-slate-900 transition-colors duration-200 font-medium placeholder:text-slate-500"
                placeholder="••••••••••••"
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-[#C9A84C] transition-colors duration-200" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Clean Solid Gold Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C9A84C] hover:bg-[#b8973b] active:bg-[#a58630] text-[#0D1B2A] font-extrabold text-xs uppercase tracking-widest px-6 py-4 rounded-xl transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0D1B2A]" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In To Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}



