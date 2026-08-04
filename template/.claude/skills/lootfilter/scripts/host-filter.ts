#!/usr/bin/env bun
/**
 * host-filter.ts — serve the filter/ download page on a public URL.
 *
 * Spins up a tiny static server over the repo's filter/ directory (index.html
 * + the .filter downloads), then opens a Cloudflare quick tunnel
 * (trycloudflare.com) pointing at it — so the download page is reachable from
 * anywhere (e.g. share the link with stream viewers) WITHOUT deploying the site.
 * The local server is just the origin; the public host IS the trycloudflare URL.
 *
 * Prereq: cloudflared installed (`brew install cloudflared`).
 *
 * Usage:
 *   bun host-filter.ts [--port 8088] [--dir <path>]
 *   Ctrl-C stops both the server and the tunnel.
 */

import { resolve, join, normalize, sep, basename, extname } from 'path'
import { existsSync } from 'fs'

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def
}

const port = Number(arg('port', '8088'))
// filter/ is 4 levels up from .claude/skills/lootfilter/scripts/
const defaultDir = resolve(import.meta.dir, '../../../../filter')
const dir = resolve(arg('dir', defaultDir)!)

if (!existsSync(join(dir, 'index.html'))) {
  console.error(`✗ No index.html in ${dir} — is this the filter/ directory?`)
  process.exit(1)
}
if (!Bun.which('cloudflared')) {
  console.error('✗ cloudflared not found. Install it: brew install cloudflared')
  process.exit(1)
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.filter': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

// ── 1. Static origin server over filter/ ─────────────────────────────────────
let server
try {
  server = Bun.serve({
    port,
    async fetch(req) {
      let path = decodeURIComponent(new URL(req.url).pathname)
      if (path === '/') path = '/index.html'
      const filePath = normalize(join(dir, path))
      if (filePath !== dir && !filePath.startsWith(dir + sep)) {
        return new Response('Forbidden', { status: 403 })
      }
      const f = Bun.file(filePath)
      if (!(await f.exists())) return new Response('Not found', { status: 404 })
      const ext = extname(filePath)
      const headers: Record<string, string> = {
        'content-type': TYPES[ext] || 'application/octet-stream',
      }
      if (ext === '.filter') {
        headers['content-disposition'] = `attachment; filename="${basename(filePath)}"`
      }
      return new Response(f, { headers })
    },
  })
} catch (e: any) {
  console.error(`✗ Cannot serve on port ${port}: ${e?.message}. Try --port <other>.`)
  process.exit(1)
}

console.error(`✓ Serving ${dir} at http://localhost:${port}`)
console.error('  Opening Cloudflare quick tunnel (trycloudflare.com)…\n')

// ── 2. Cloudflare quick tunnel → public URL ──────────────────────────────────
const cf = Bun.spawn(['cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
  stdout: 'pipe',
  stderr: 'pipe',
})

let publicUrl = ''
let connected = false
async function pump(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return
  const dec = new TextDecoder()
  for await (const chunk of stream) {
    const text = dec.decode(chunk)
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
    if (m && !publicUrl) {
      publicUrl = m[0]
      console.error('\n  ┌──────────────────────────────────────────────────────')
      console.error('  │  FILTER HOST  (khác dev:tunnel — đây mới là trang filter)')
      console.error(`  │  PUBLIC URL:  ${publicUrl}`)
      console.error(`  │  Filter:      ${publicUrl}/leedgod.filter`)
      console.error('  └──────────────────────────────────────────────────────')
      console.error('  …chờ tunnel kết nối edge (đừng mở URL trước khi thấy "connected")\n')
    }
    // cloudflared confirms the tunnel is live with "Registered tunnel connection"
    if (!connected && /registered tunnel connection/i.test(text)) {
      connected = true
      console.error(`✓ Tunnel connected — mở: ${publicUrl}\n`)
    }
    if (/\berr(or)?\b|failed|unable|refused/i.test(text)) process.stderr.write(text)
  }
}
pump(cf.stdout)
pump(cf.stderr)

// ── 3. Clean shutdown — never orphan cloudflared ─────────────────────────────
let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  console.error('\n⏹  Stopping tunnel + server…')
  try { cf.kill() } catch {}
  try { server?.stop(true) } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await cf.exited
shutdown()
