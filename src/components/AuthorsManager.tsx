'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Check, RefreshCw, User, Briefcase, Tag, Link as LinkIcon } from 'lucide-react'
import { cleanImageUrl } from '@/utils/cleanImageUrl'

interface Author {
  id: string | number
  name: string
  role: string
  department: 'engineering' | 'sales' | 'hr-ops' | 'marketing' | 'executive'
  avatar?: string
}

const DEPARTMENT_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  sales: 'Sales & Growth',
  'hr-ops': 'HR & Operations',
  marketing: 'Marketing',
  executive: 'Executive'
}

const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  sales: 'bg-amber-50 text-amber-700 border-amber-100',
  'hr-ops': 'bg-[#2563eb]/5 text-[#2563eb] border-[#2563eb]/10',
  marketing: 'bg-pink-50 text-pink-700 border-pink-100',
  executive: 'bg-purple-50 text-purple-700 border-purple-100'
}

export const AuthorsManager: React.FC = () => {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Drawer / Form states
  const [isOpen, setIsOpen] = useState(false)
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null)
  
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState<Author['department']>('hr-ops')
  const [avatar, setAvatar] = useState('')

  const fetchAuthors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/authors?limit=100')
      if (!response.ok) throw new Error('Failed to fetch authors')
      const data = await response.json()
      setAuthors(data.docs || [])
      setError('')
    } catch (err: any) {
      setError(err.message || 'Something went wrong while fetching authors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthors()
  }, [])

  const handleOpenAdd = () => {
    setEditingAuthor(null)
    setName('')
    setRole('Technical Recruiter')
    setDepartment('hr-ops')
    setAvatar('')
    setError('')
    setSuccess('')
    setIsOpen(true)
  }

  const handleOpenEdit = (author: Author) => {
    setEditingAuthor(author)
    setName(author.name)
    setRole(author.role)
    setDepartment(author.department)
    setAvatar(author.avatar || '')
    setError('')
    setSuccess('')
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim() || !role.trim()) {
      setError('Name and Role are required fields.')
      return
    }

    const payload = {
      name,
      role,
      department,
      avatar: cleanImageUrl(avatar) || undefined
    }

    try {
      const url = editingAuthor ? `/api/authors/${editingAuthor.id}` : '/api/authors'
      const method = editingAuthor ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Operation failed')
      }

      setSuccess(editingAuthor ? 'Author updated successfully!' : 'New author added successfully!')
      setIsOpen(false)
      fetchAuthors()
    } catch (err: any) {
      setError(err.message || 'Failed to submit form.')
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this author?')) return
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/authors/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) throw new Error('Failed to delete author')
      setSuccess('Author deleted successfully!')
      fetchAuthors()
    } catch (err: any) {
      setError(err.message || 'Failed to delete author.')
    }
  }

  return (
    <div className="space-y-6 relative text-left">
      {/* Top action header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#090d16] tracking-tight">Team Authors</h2>
          <p className="text-xs text-slate-400 font-semibold">Manage corporate contributors and their recruitment roles.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-md shadow-[#2563eb]/10 cursor-pointer hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" /> Add Contributor
        </button>
      </div>

      {/* Success/Error Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-[#2563eb]/5 border border-[#2563eb]/10 text-[#2563eb] text-xs font-semibold rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> {success}</span>
          <button onClick={() => setSuccess('')} className="text-[#2563eb] hover:opacity-80"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="small-group-card p-16 text-center bg-white border border-slate-200/60 shadow-sm flex flex-col items-center justify-center gap-3 rounded-3xl">
          <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Loading authors list...</p>
        </div>
      ) : authors.length === 0 ? (
        /* Empty State */
        <div className="small-group-card p-16 text-center bg-white border border-slate-200/60 shadow-sm flex flex-col items-center justify-center gap-3 rounded-3xl">
          <User className="w-12 h-12 text-slate-200" />
          <h3 className="text-sm font-bold text-slate-700">No Authors Registered</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">Add your corporate contributors to assign them to editorial articles.</p>
        </div>
      ) : (
        /* Authors list grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {authors.map((author) => (
            <div
              key={author.id}
              className="small-group-card bg-white p-6 border border-slate-200/60 rounded-3xl shadow-sm flex flex-col justify-between gap-5 relative group"
            >
              {/* Profile Card details */}
              <div className="flex items-start gap-4">
                {author.avatar ? (
                  <img
                    src={cleanImageUrl(author.avatar)}
                    alt={author.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-100 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-100 shadow-sm">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div className="text-left space-y-1">
                  <h4 className="text-sm font-bold text-[#090d16] tracking-tight leading-tight">{author.name}</h4>
                  <p className="text-[11px] text-slate-400 font-semibold">{author.role}</p>
                  <span className={`inline-block border px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1.5 ${DEPARTMENT_COLORS[author.department] || 'bg-slate-50 text-slate-600'}`}>
                    {DEPARTMENT_LABELS[author.department] || author.department}
                  </span>
                </div>
              </div>

              {/* Action operations */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => handleOpenEdit(author)}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#2563eb] bg-slate-50 hover:bg-[#2563eb]/5 px-3 py-2 rounded-xl border border-slate-200/50 hover:border-[#2563eb]/20 transition-all duration-200 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(author.id)}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-3 py-2 rounded-xl border border-slate-200/50 hover:border-rose-200/30 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Author Slide-over Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop mask */}
          <div 
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          />

          {/* Form Panel Container */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-100 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header section */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#090d16] text-base">{editingAuthor ? 'Edit Author' : 'Add New Author'}</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{editingAuthor ? 'Modify existing contributor info' : 'Add a new member to the editorial list'}</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form body input fields */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Contributor Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-300" /> Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2563eb] focus:bg-white rounded-xl px-4 py-2.5 text-xs outline-none transition-all text-slate-800 font-semibold shadow-inner"
                  required
                />
              </div>

              {/* Title / Corporate Role */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-300" /> Role / Title *
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Lead Talent Scout"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2563eb] focus:bg-white rounded-xl px-4 py-2.5 text-xs outline-none transition-all text-slate-800 font-semibold shadow-inner"
                  required
                />
              </div>

              {/* Department Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-300" /> Corporate Department *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Author['department'])}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2563eb] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all text-slate-800 font-semibold shadow-inner"
                >
                  <option value="hr-ops">HR & Operations</option>
                  <option value="engineering">Engineering</option>
                  <option value="sales">Sales & Growth</option>
                  <option value="marketing">Marketing</option>
                  <option value="executive">Executive</option>
                </select>
              </div>

              {/* Profile Avatar Picture URL */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-300" /> Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="e.g. https://images.unsplash.com/..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2563eb] focus:bg-white rounded-xl px-4 py-2.5 text-xs outline-none transition-all text-slate-800 font-medium shadow-inner"
                />
                <p className="text-[9px] text-slate-400 italic">Leave empty to use generic system icon profile picture.</p>
              </div>

            </form>

            {/* Form actions footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-[#2563eb]/10 transition-colors cursor-pointer"
              >
                {editingAuthor ? 'Save Changes' : 'Add Contributor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
