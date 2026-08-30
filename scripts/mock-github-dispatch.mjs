/**
 * Local stand-in for GitHub's repository_dispatch API.
 *
 * Lets you test the whole publish flow without a real token or touching the
 * ovopainting repo. It accepts the dispatch, prints the markdown file the CMS
 * generated, and saves it so you can eyeball it.
 *
 *   node scripts/mock-github-dispatch.mjs
 *
 * Then start the CMS pointed at it:
 *
 *   GITHUB_API_BASE_URL=http://127.0.0.1:8899 OVO_GITHUB_TOKEN=fake npm run dev
 */
import http from 'http'
import fs from 'fs'
import path from 'path'

const PORT = Number(process.env.MOCK_PORT || 8899)
const OUT_DIR = path.join(process.cwd(), '.mock-dispatch')

fs.mkdirSync(OUT_DIR, { recursive: true })

http
  .createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`${req.method} ${req.url}`)

      let body
      try {
        body = JSON.parse(raw || '{}')
      } catch {
        console.log('Body was not JSON:', raw.slice(0, 200))
        res.writeHead(400).end()
        return
      }

      const payload = body.client_payload || {}
      console.log(`event_type : ${body.event_type}`)
      console.log(`slug       : ${payload.slug}`)
      console.log(`branch     : ${payload.branch}`)

      if (payload.content_base64) {
        const markdown = Buffer.from(payload.content_base64, 'base64').toString('utf8')
        const file = path.join(OUT_DIR, payload.file_name || `${payload.slug}.md`)
        fs.writeFileSync(file, markdown)
        console.log(`saved      : ${path.relative(process.cwd(), file)}`)
        console.log(`${'-'.repeat(70)}\n${markdown}`)
      }

      // GitHub answers a successful dispatch with 204 No Content.
      res.writeHead(204).end()
    })
  })
  .listen(PORT, () => {
    console.log(`Mock GitHub dispatch API listening on http://127.0.0.1:${PORT}`)
    console.log(`Generated markdown files will be written to ${OUT_DIR}\n`)
  })
