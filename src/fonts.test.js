// @vitest-environment node
// F-2: fonts are self-hosted, so pages never contact Google, and the CSP
// allows fonts and styles from this site only.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fontPreloadTags } from '../vite.config.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

function cspDirectives() {
  const config = JSON.parse(read('../vercel.json'))
  const header = config.headers.flatMap((block) => block.headers)
    .find((h) => h.key.startsWith('Content-Security-Policy'))
  return Object.fromEntries(header.value.split(';').map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]))
}

describe('self-hosted fonts', () => {
  it('index.html and the stylesheets no longer load anything from Google', () => {
    for (const file of ['../index.html', './styles.css', './fonts.css', './main.jsx']) {
      expect(read(file)).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    }
  })

  it('declares the three families from local files, Latin only', () => {
    const css = read('./fonts.css')
    for (const family of ["'Source Serif 4'", "'Inter'", "'JetBrains Mono'"]) expect(css).toContain(`font-family: ${family}`)
    const sources = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])
    expect(sources).toHaveLength(3)
    for (const src of sources) expect(src).toMatch(/^@fontsource.*-latin-.*\.woff2$/)
  })

  it('the CSP allows styles and fonts from this site only', () => {
    const csp = cspDirectives()
    expect(csp['font-src']).toEqual(["'self'"])
    expect(csp['style-src']).toEqual(["'self'", "'unsafe-inline'"])
    expect(JSON.stringify(csp)).not.toMatch(/google/)
  })

  it('preloads the body font from the built bundle', () => {
    const tags = fontPreloadTags({ 'assets/inter-latin-wght-normal-abc123.woff2': {}, 'assets/index.js': {} })
    expect(tags).toEqual([{
      tag: 'link',
      attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/assets/inter-latin-wght-normal-abc123.woff2', crossorigin: '' },
      injectTo: 'head',
    }])
    expect(fontPreloadTags({})).toEqual([])
  })
})
