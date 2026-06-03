/**
 * clear-db.mjs — Direct Postgres wipe, no external deps beyond pg
 * Run with: node scripts/clear-db.mjs
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Manually parse the .env file — no dotenv needed
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const envVars = loadEnv(path.resolve(__dirname, '../.env'))
const rawUri = envVars.DATABASE_URI || process.env.DATABASE_URI || ''
const connectionString = rawUri.replace(/:6543(\/|$)/, ':5432$1')

if (!connectionString) {
  console.error('❌  DATABASE_URI not found in .env')
  process.exit(1)
}

console.log('🔗  Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'))

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function clearAll() {
  await client.connect()
  console.log('🔌  Connected!\n')

  // Get all tables in the public schema
  const tablesRes = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `)

  const tables = tablesRes.rows.map(r => r.tablename)
  console.log(`Found ${tables.length} tables: ${tables.join(', ')}\n`)

  // Disable FK constraints, truncate, re-enable
  await client.query('SET session_replication_role = replica;')
  for (const table of tables) {
    await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`)
    console.log(`  ✓ Cleared: ${table}`)
  }
  await client.query('SET session_replication_role = DEFAULT;')

  console.log('\n✅  All tables cleared successfully!')
  console.log('👉  Go to /admin on your deployed site to create a fresh admin account.\n')
  await client.end()
}

clearAll().catch(async (err) => {
  console.error('\n❌  Error:', err.message)
  await client.end().catch(() => {})
  process.exit(1)
})
