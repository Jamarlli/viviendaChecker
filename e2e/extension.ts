// ExtensiÃ³n cargada en Chromium con Idealista servido desde fixtures y Catastro grabado o real.
// `npm run e2e`: grabado. `E2E_CATASTRO=real`: API real; con `E2E_GRABAR=1` ademÃ¡s graba.
// `E2E_HEADED=1`: con ventana.
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const EXTENSION = resolve('.output/chrome-mv3-e2e')
const IDEALISTA = 'fixtures/idealista'
const GRABACIONES = 'fixtures/catastro/e2e'
export const REAL = process.env.E2E_CATASTRO === 'real'
const GRABAR = REAL && !!process.env.E2E_GRABAR

export const urlAnuncio = (id: string) => `https://www.idealista.com/inmueble/${id}/`

const TIPOS = { json: 'application/json', xml: 'text/xml' } as const
const fichero = (u: string, ext: keyof typeof TIPOS) =>
  join(GRABACIONES, `${createHash('sha1').update(u).digest('hex').slice(0, 16)}.${ext}`)

async function enrutar(context: BrowserContext, faltan: string[]) {
  // Nada sale a la red salvo lo servido abajo (las rutas posteriores tienen prioridad).
  await context.route(/^https?:/, (r) => r.abort())
  await context.route(/^https:\/\/www\.idealista\.com\/inmueble\/\d+\/$/, (r) => {
    const id = /inmueble\/(\d+)/.exec(r.request().url())?.[1] ?? ''
    const f = join(IDEALISTA, `${id}.html`)
    if (!existsSync(f)) return r.fulfill({ status: 404 })
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: readFileSync(f) })
  })
  await context.route('https://ovc.catastro.meh.es/**', async (r) => {
    const u = r.request().url()
    if (!REAL) {
      for (const ext of ['json', 'xml'] as const) {
        const f = fichero(u, ext)
        if (existsSync(f)) return r.fulfill({ contentType: TIPOS[ext], body: readFileSync(f) })
      }
      faltan.push(u)
      return r.fulfill({ status: 503 })
    }
    const res = await r.fetch()
    const cuerpo = await res.text()
    // En mantenimiento responde 200 con un error XML (`lerr`): no se graba.
    if (GRABAR && res.ok() && !cuerpo.includes('<lerr>')) {
      mkdirSync(GRABACIONES, { recursive: true })
      writeFileSync(fichero(u, cuerpo.trimStart().startsWith('<') ? 'xml' : 'json'), cuerpo)
    }
    return r.fulfill({ response: res, body: cuerpo })
  })
}

export interface Extension {
  context: BrowserContext
  /** Peticiones al Catastro sin grabaciÃ³n (modo grabado). */
  faltan: string[]
  /** Abre el anuncio y el panel fijado a su pestaÃ±a, a 360 px. */
  abrir(idAnuncio: string): Promise<{ anuncio: Page; panel: Page }>
}

export const test = base.extend<{ ext: Extension }>({
  ext: [
    // eslint-disable-next-line no-empty-pattern -- firma de fixture de Playwright
    async ({}, use) => {
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: !process.env.E2E_HEADED,
        args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
      })
      const faltan: string[] = []
      await enrutar(context, faltan)
      const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
      const id = new URL(sw.url()).host

      async function abrir(idAnuncio: string) {
        const anuncio = await context.newPage()
        await anuncio.goto(urlAnuncio(idAnuncio))
        await anuncio.bringToFront()
        const tab = await sw.evaluate(async () => {
          const { chrome } = globalThis as unknown as { chrome: typeof browser }
          const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
          return t?.id
        })
        const panel = await context.newPage()
        await panel.setViewportSize({ width: 360, height: 800 })
        await panel.goto(`chrome-extension://${id}/sidepanel.html?tab=${tab}`)
        return { anuncio, panel }
      }

      await use({ context, faltan, abrir })
      await context.close()
    },
    { scope: 'test' },
  ],
})

export { expect } from '@playwright/test'
