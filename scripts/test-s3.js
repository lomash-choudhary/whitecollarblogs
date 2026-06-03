import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const envContent = fs.readFileSync(path.join(dirname, '../.env'), 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    }
    env[match[1]] = value
  }
})

async function run() {
  console.log('Testing raw S3 connection to Supabase Storage manually...')
  
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    },
    region: env.S3_REGION || 'ap-south-1',
    forcePathStyle: true,
  })

  try {
    const res = await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET || 'media',
        Key: 'media/s3-test-file.txt',
        Body: 'Hello Supabase Storage S3 from manual diagnostics!',
        ContentType: 'text/plain',
      })
    )
    console.log('✅ S3 upload successful! Response:', res)
  } catch (err) {
    console.error('❌ S3 upload failed with error:')
    console.error(err)
  }
}

run()
