// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { serviceWorkerSource } from '../vite.config.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

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

describe('service worker: online only', () => {
  const src = serviceWorkerSource('<html>')

  it('keeps no copy of the app: it never answers page or file requests itself', () => {
    expect(src).not.toMatch(/addEventListener\('fetch'/)
    expect(src).not.toMatch(/cache\.(put|addAll)\(/)
  })

  it('removes the copies the old offline version left on phones, and takes over straight away', () => {
    expect(src).toMatch(/caches\.delete/)
    expect(src).toMatch(/k\.startsWith\('housemaster-'\)/)
    expect(src).toMatch(/skipWaiting\(\)/)
    expect(src).toMatch(/clients\.claim\(\)/)
  })

  it('changes whenever the app changes, so browsers fetch the new worker', () => {
    expect(serviceWorkerSource('<html>a</html>')).not.toBe(serviceWorkerSource('<html>b</html>'))
  })
})
