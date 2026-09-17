/**
 * Name of the cookie holding the website selected in the sidebar.
 *
 * Its own module, and deliberately dependency-free: the client writes the
 * cookie and server components read it back, so the two halves must agree, but
 * neither should pull the other's imports into its bundle — `sites.ts` reads
 * publishing env vars and `activeSite.ts` imports `next/headers`.
 */
export const SITE_COOKIE = 'wcb_active_site'
