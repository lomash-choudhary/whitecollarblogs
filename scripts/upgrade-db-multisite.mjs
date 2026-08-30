/**
 * One-time schema upgrade for multi-site publishing.
 *
 * The Payload config runs with `push: false`, so new fields on the `posts`
 * collection have to be added to Postgres by hand. This script is idempotent —
 * running it twice is safe.
 *
 *   node scripts/upgrade-db-multisite.mjs
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

// Minimal .env loader so the script works without extra dependencies.
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

const connectionString =
  process.env.DATABASE_URI || 'postgresql://postgres:postgres@127.0.0.1:5432/payload'

const STATEMENTS = [
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS site varchar DEFAULT 'wcb'`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS external_status varchar`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS external_message varchar`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS external_url varchar`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_dispatched_at timestamp(3) with time zone`,
  `UPDATE posts SET site = 'wcb' WHERE site IS NULL`,
  `CREATE INDEX IF NOT EXISTS posts_site_key_idx ON posts (site)`,
]

const client = new pg.Client({ connectionString })

try {
  await client.connect()
  console.log(`Connected to ${connectionString.replace(/:[^:@/]+@/, ':****@')}`)
  for (const sql of STATEMENTS) {
    await client.query(sql)
    console.log(`  ✓ ${sql}`)
  }
  console.log('\nSchema is up to date for multi-site publishing.')
} catch (err) {
  console.error('\nSchema upgrade failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
