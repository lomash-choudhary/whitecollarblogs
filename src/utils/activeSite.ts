import { cookies } from 'next/headers'
import { DEFAULT_SITE_KEY, getSite, isKnownSite, type SiteConfig } from '@/config/sites'

export { siteWhere } from '@/config/sites'

export const SITE_COOKIE = 'wcb_active_site'

/**
 * Reads the website the user has selected in the portal's sidebar.
 * Server components use this to scope their queries to a single website.
 */
export async function getActiveSite(): Promise<SiteConfig> {
  try {
    const store = await cookies()
    const value = store.get(SITE_COOKIE)?.value
    return getSite(isKnownSite(value) ? value : DEFAULT_SITE_KEY)
  } catch {
    return getSite(DEFAULT_SITE_KEY)
  }
}
