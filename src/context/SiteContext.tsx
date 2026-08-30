'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PublicSite } from '@/config/sites'

export const SITE_COOKIE = 'wcb_active_site'

interface SiteContextValue {
  sites: PublicSite[]
  activeSite: PublicSite
  setActiveSite: (key: string) => void
}

const SiteContext = createContext<SiteContextValue | null>(null)

function writeSiteCookie(key: string) {
  // 1 year, readable by server components so dashboards can filter per site.
  document.cookie = `${SITE_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=31536000; samesite=lax`
}

export const SiteProvider: React.FC<{
  sites: PublicSite[]
  initialSiteKey: string
  children: React.ReactNode
}> = ({ sites, initialSiteKey, children }) => {
  const router = useRouter()
  const [activeKey, setActiveKey] = useState(initialSiteKey)

  const setActiveSite = useCallback(
    (key: string) => {
      if (!sites.some((s) => s.key === key)) return
      setActiveKey(key)
      writeSiteCookie(key)
      // Server components read the cookie, so pull fresh data for the new site.
      router.refresh()
    },
    [router, sites],
  )

  const value = useMemo<SiteContextValue>(() => {
    const activeSite = sites.find((s) => s.key === activeKey) || sites[0]
    return { sites, activeSite, setActiveSite }
  }, [sites, activeKey, setActiveSite])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside a <SiteProvider>')
  return ctx
}
