/**
 * clear-db.ts
 * Run with: npx tsx scripts/clear-db.ts
 *
 * Clears ALL data from every Payload collection but leaves
 * the database schema/tables intact. After running this you
 * should create a fresh admin user via the Payload admin panel
 * at /admin or use the API to register.
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function clearDatabase() {
  console.log('\n🗑️  Clearing all Payload collections...\n')
  const payload = await getPayload({ config })

  const collections = ['posts', 'authors', 'pipeline-stages', 'media', 'users'] as const

  for (const slug of collections) {
    try {
      const result = await payload.find({ collection: slug as any, limit: 1000, depth: 0 })
      let deleted = 0
      for (const doc of result.docs) {
        await payload.delete({ collection: slug as any, id: doc.id })
        deleted++
      }
      console.log(`  ✓ ${slug}: deleted ${deleted} record(s)`)
    } catch (err: any) {
      console.error(`  ✗ ${slug}: ${err.message}`)
    }
  }

  console.log('\n✅  Database cleared. You can now re-create your admin user at /admin\n')
  process.exit(0)
}

clearDatabase().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
