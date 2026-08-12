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

async function checkCount() {
  await client.connect();
  const res = await client.query("SELECT content FROM posts WHERE slug = 'what-books-should-i-read-in-prison';");
  const content = res.rows[0]?.content;
  if (content) {
    function findNode(nodes, urlPart) {
      for (const n of nodes) {
        if ((n.url && n.url.includes(urlPart)) || (n.src && n.src.includes(urlPart))) {
          return n;
        }
        if (n.children) {
          const found = findNode(n.children, urlPart);
          if (found) return found;
        }
      }
      return null;
    }
    const node = findNode(content.root?.children || [], '71tgpynbVL');
    console.log('--- FOUND IMAGE NODE IN DB ---');
    console.log(JSON.stringify(node, null, 2));
  }
  await client.end();
}

checkCount().catch(async err => {
  console.error(err);
  await client.end();
});
