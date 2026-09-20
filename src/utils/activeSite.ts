import { cookies } from 'next/headers'
import {
  DEFAULT_SELECTABLE_SITE_KEY,
  getSite,
  isSelectableSite,
  type SiteConfig,
} from '@/config/sites'
import { SITE_COOKIE } from '@/config/siteCookie'

export { siteWhere } from '@/config/sites'
export { SITE_COOKIE }

/**
 * Reads the website the user has selected in the portal's sidebar.
 * Server components use this to scope their queries to a single website.
 */
export async function getActiveSite(): Promise<SiteConfig> {
  try {
    const store = await cookies()
    const value = store.get(SITE_COOKIE)?.value
    // `isSelectableSite`, not `isKnownSite`: `wcb` is still a real site key —
    // it is what a NULL `site` row is matched by — but it is off the switcher,
    // so a cookie still holding it would scope the whole dashboard to a
    // website the sidebar cannot display or change away from.
    return getSite(isSelectableSite(value) ? value : DEFAULT_SELECTABLE_SITE_KEY)
  } catch {
    return getSite(DEFAULT_SELECTABLE_SITE_KEY)
  }
}
