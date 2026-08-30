/**
 * Emergency admin account recovery.
 *
 * This endpoint creates (or resets) the admin login. That is obviously not
 * something the open internet should be able to do, so:
 *
 *   - In development it works as-is, for convenience.
 *   - In production it does nothing unless ADMIN_RESET_TOKEN is set on the
 *     server AND the same value is passed as ?token=... on the request.
 *
 * Leave ADMIN_RESET_TOKEN unset in production and the route is simply off.
 */
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = process.env.ADMIN_RESET_EMAIL || 'admin@whitecollar.com'
const ADMIN_PASSWORD = process.env.ADMIN_RESET_PASSWORD || 'admin123'

export async function GET(request: Request) {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const expected = process.env.ADMIN_RESET_TOKEN
    const provided = new URL(request.url).searchParams.get('token')

    if (!expected) {
      return Response.json(
        { success: false, error: 'Account recovery is disabled on this server.' },
        { status: 404 },
      )
    }
    if (provided !== expected) {
      return Response.json({ success: false, error: 'Not found.' }, { status: 404 })
    }
    if (!process.env.ADMIN_RESET_PASSWORD) {
      return Response.json(
        { success: false, error: 'Set ADMIN_RESET_PASSWORD before using recovery in production.' },
        { status: 400 },
      )
    }
  }

  try {
    const payload = await getPayload({ config })
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: ADMIN_EMAIL } },
    })

    if (found.totalDocs > 0) {
      await payload.update({
        collection: 'users',
        id: found.docs[0].id,
        data: { password: ADMIN_PASSWORD },
      })
      return Response.json({ success: true, message: `Password reset for ${ADMIN_EMAIL}.` })
    }

    await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin' },
    })
    return Response.json({ success: true, message: `Admin created: ${ADMIN_EMAIL}.` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
