// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { precacheList, serviceWorkerSource } from '../vite.config.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

// A small stand-in for Rollup's output bundle.
const bundle = {
  'assets/index-abc123.js': { type: 'chunk', isEntry: true, imports: ['assets/vendor-def456.js'], dynamicImports: ['assets/pdf-999.js'] },
  'assets/vendor-def456.js': { type: 'chunk', isEntry: false, imports: [] },
  'assets/pdf-999.js': { type: 'chunk', isEntry: false, imports: [] },
  'assets/pdf.worker.min-777.mjs': { type: 'asset' },
  'assets/index-aaa111.css': { type: 'asset' },
  'assets/index-abc123.js.map': { type: 'asset' },
  'assets/inter-latin-wght-normal-xyz.woff2': { type: 'asset' },
  'index.html': { type: 'asset' },
}

describe('installable app', () => {
  it('has a web app manifest the browser can install from', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'))
    expect(manifest.name).toBe('HouseMaster')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icon of manifest.icons) {
      expect(existsSync(new URL(`public${icon.src}`, root))).toBe(true)
    }
  })

  it('links the manifest and an icon for phones from the page', () => {
    const html = read('index.html')
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('name="theme-color"')
  })

  it('tells Vercel never to keep an old copy of the service worker', () => {
    const vercel = JSON.parse(read('vercel.json'))
    const sw = vercel.headers.find((h) => h.source === '/sw.js')
    expect(sw.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'Cache-Control', value: expect.stringMatching(/no-cache/) }),
    ]))
  })
})

describe('service worker', () => {
  it('stores the page and the files it needs to start, not the large PDF viewer or source maps', () => {
    const list = precacheList(bundle, '/')
    expect(list).toEqual(expect.arrayContaining([
      '/', '/index.html', '/manifest.webmanifest', '/housemaster-logo.png', '/housemaster-mark-light.png',
      '/assets/index-abc123.js', '/assets/vendor-def456.js', '/assets/index-aaa111.css',
    ]))
    expect(list.some((f) => f.includes('pdf'))).toBe(false)
    expect(list.some((f) => f.endsWith('.map'))).toBe(false)
  })

  it('gets a new cache name whenever the app changes, so phones pick up new versions', () => {
    const a = serviceWorkerSource(['/', '/assets/index-abc123.js'])
    const b = serviceWorkerSource(['/', '/assets/index-new999.js'])
    const name = (src) => src.match(/const CACHE = '([^']+)'/)[1]
    expect(name(a)).not.toBe(name(b))
    expect(name(a)).toBe(name(serviceWorkerSource(['/', '/assets/index-abc123.js'])))
  })

  it('only handles this site’s own GET requests, never the API or anything being saved', () => {
    const src = serviceWorkerSource(['/'])
    expect(src).toMatch(/request\.method !== 'GET'/)
    expect(src).toMatch(/url\.origin !== self\.location\.origin/)
  })
})
