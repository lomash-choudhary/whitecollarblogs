/* eslint-disable @typescript-eslint/no-explicit-any */
import { siteWhere } from '@/config/sites'

/**
 * Every post belonging to one website, in one query.
 *
 * `pagination: false` is the whole point of this helper. A page limit on a
 * screen that *counts* rows is a wrong number, not a missing row: the overview
 * read its first 10 posts and reported "10 blogs" while the pipeline board,
 * which asked for 100, listed 15 of them. Any screen that shows a count has to
 * see every row, so all three of them go through here.
 */
export async function findSitePosts(
  payload: any,
  siteKey: string,
  overrides: Record<string, unknown> = {},
): Promise<any[]> {
  const result = await payload.find({
    collection: 'posts',
    where: siteWhere(siteKey),
    pagination: false,
    depth: 1,
    ...overrides,
  })
  return result.docs ?? []
}

/**
 * The stage a post counts as. `stage` is a required relationship, so an
 * unpopulated one means the row points at a stage that no longer exists —
 * parked on `draft` rather than dropped, because a post the overview counts
 * and the board hides is the mismatch this module exists to remove.
 */
export function stageKeyOf(post: any): string {
  const stage = post?.stage
  if (stage && typeof stage === 'object' && stage.key) return stage.key as string
  return 'draft'
}

export type StageCounts = {
  total: number
  draft: number
  review: number
  approved: number
  scheduled: number
  published: number
}

export function countPostsByStage(posts: any[]): StageCounts {
  const counts: StageCounts = {
    total: posts.length,
    draft: 0,
    review: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
  }

  for (const post of posts) {
    const key = stageKeyOf(post)
    if (key === 'published') counts.published++
    else if (key === 'review') counts.review++
    else if (key === 'approved') counts.approved++
    else if (key === 'scheduled') counts.scheduled++
    else counts.draft++
  }

  return counts
}
