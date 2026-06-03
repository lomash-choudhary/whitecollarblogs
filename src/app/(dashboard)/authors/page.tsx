import React from 'react'
import { AuthorsManager } from '@/components/AuthorsManager'

export default function AuthorsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card bg-white p-6 md:p-8 border border-slate-100 rounded-2xl shadow-sm">
        <AuthorsManager />
      </div>
    </div>
  )
}
