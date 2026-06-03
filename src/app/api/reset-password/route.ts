import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: 'admin@whitecollar.com' } },
    })

    if (found.totalDocs > 0) {
      await payload.update({
        collection: 'users',
        id: found.docs[0].id,
        data: { password: 'admin123' },
      })
      return Response.json({ success: true, message: 'Password reset. Login: admin@whitecollar.com / admin123' })
    }

    // User doesn't exist at all, create it
    await payload.create({
      collection: 'users',
      data: { email: 'admin@whitecollar.com', password: 'admin123', name: 'Admin' },
    })
    return Response.json({ success: true, message: 'Admin created. Login: admin@whitecollar.com / admin123' })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
