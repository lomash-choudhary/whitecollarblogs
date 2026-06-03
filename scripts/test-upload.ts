import { getPayload } from 'payload'
import config from '../src/payload.config'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

async function run() {
  console.log('\n🚀 Testing upload via Payload Local API to diagnose Supabase Storage issues...\n')
  const payload = await getPayload({ config })
  
  const testImagePath = path.join(dirname, 'test.jpg')
  fs.writeFileSync(testImagePath, 'dummy content representing an image file')
  
  try {
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: 'Test upload diagnostics',
      },
      file: {
        name: 'test.jpg',
        mimetype: 'image/jpeg',
        size: fs.statSync(testImagePath).size,
        data: fs.readFileSync(testImagePath),
      },
    })
    console.log('✅ Success! Media created in DB and stored in Supabase:', mediaDoc)
  } catch (err: any) {
    console.error('❌ Upload Error Details:')
    console.error(err)
  } finally {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath)
    }
    process.exit(0)
  }
}

run()
