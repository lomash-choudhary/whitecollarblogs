/**
 * This app's own identity for `articleSeo.ts` and `articleSchema.ts`.
 *
 * Every site repo has a file of this name holding its own constant; only this
 * one derives it from `src/config/sites.ts`, because the CMS is the one place
 * that already knows what each website is called and where it serves articles
 * from. Both shared modules stay byte-identical in all four repos — the
 * per-site differences live here, which is why they are not part of them.
 *
 * The return type is `SchemaSite`, which extends `SeoSite`: one constant
 * describes the site to both modules, so a `<title>` built from one name and a
 * `publisher` built from another is not expressible.
 */

import { DEFAULT_SITE_KEY, getSite } from '@/config/sites'
import type { SchemaSite } from './articleSchema'

/**
 * A function, not a const: `baseUrl` comes from NEXT_PUBLIC_SERVER_URL, and a
 * const would freeze whatever that was when the module first loaded.
 */
export function seoSite(): SchemaSite {
  const site = getSite(DEFAULT_SITE_KEY)
  return {
    siteName: site.name,
    baseUrl: site.baseUrl,
    blogPath: site.blogPath,
    locale: 'en_US',
    // Comes from the same `defaultHeroImage` the publish path already uses, so
    // there is one fallback image per website rather than two that can drift.
    // It is unset for this app today: the three painting sites each have a
    // branded hero to fall back to, and this one has no such asset in /public.
    // A post with no cover image therefore emits no `og:image` — which is
    // right, because an `og:image` pointing at nothing is worse than none.
    // Drop a 1200x630 image in /public and name it in `sites.ts` to close it.
    defaultOgImage: site.defaultHeroImage,
    // `logo` and `organizationId` are both unset, and both deliberately.
    // There is no brand asset in /public to point `logo` at — the same gap
    // `defaultOgImage` has — so the publisher carries a name and no image.
    // `organizationId` stays unset because this app's layout emits no
    // organization node of its own: setting it would make every article's
    // `publisher` a reference to a node that is not on the page.
  }
}
