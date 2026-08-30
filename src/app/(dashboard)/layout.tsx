import React from 'react'
import { Sidebar } from '../../components/Sidebar'
import { Header } from '../../components/Header'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { redirect } from 'next/navigation'
import { SiteProvider } from '@/context/SiteContext'
import { publicSites } from '@/config/sites'
import { getActiveSite } from '@/utils/activeSite'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforce password protection for the entire dashboard.
  // If auth check fails for any reason (DB error, network), redirect to login.
  try {
    const reqHeaders = await headers()
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: reqHeaders })

    if (!user) {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }

  const activeSite = await getActiveSite()

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f8fafc] text-[#0f172a] font-sans flex flex-col">
        <SiteProvider sites={publicSites()} initialSiteKey={activeSite.key}>
          <div className="min-h-screen flex bg-slate-50/50">
            {/* Fixed Navigation Sidebar */}
            <Sidebar />

            {/* Main Workspace Area */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
              {/* Sticky Header */}
              <Header />

              {/* Dynamic Page Views */}
              <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
                {children}
              </main>
            </div>
          </div>
        </SiteProvider>
      </body>
    </html>
  )
}
