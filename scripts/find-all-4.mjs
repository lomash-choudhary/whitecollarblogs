import pg from 'pg';
import fs from 'fs';

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const envVars = loadEnv('./.env');
const rawUri = envVars.DATABASE_URI || '';
const connectionString = rawUri.replace(/:6543(\/|$)/, ':5432$1');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function find() {
  await client.connect();
  const res = await client.query("SELECT id, title, slug, stage_id FROM posts WHERE slug LIKE '%book%' OR slug LIKE '%bowyer%' OR slug LIKE '%indictment%' OR slug LIKE '%psr-interview%' OR slug LIKE '%probation-interview%';");
  console.log('--- FOUND POSTS ---');
  console.log(res.rows);
  await client.end();
}

find().catch(async err => {
  console.error(err);
  await client.end();
});
