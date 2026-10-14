// Extensión cargada en Chromium con Idealista servido desde fixtures y Catastro grabado o real.
// `npm run e2e`: grabado. `E2E_CATASTRO=real`: API real; con `E2E_GRABAR=1` además graba.
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
const PAUSA_REAL_MS = 400

export const urlAnuncio = (id: string) => `https://www.idealista.com/inmueble/${id}/`

const fichero = (u: string) =>
  join(GRABACIONES, createHash('sha1').update(u).digest('hex').slice(0, 16) + '.json')

function esJson(texto: string): boolean {
  try {
    JSON.parse(texto)
    return true
  } catch {
    return false
  }
}

let ultima = 0
let cola: Promise<unknown> = Promise.resolve()
/** En serie y con pausa: el Catastro corta las ráfagas. */
function turno<T>(f: () => Promise<T>): Promise<T> {
  const t = cola.then(async () => {
    const espera = ultima + PAUSA_REAL_MS - Date.now()
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    try {
      return await f()
    } finally {
      ultima = Date.now()
    }
  })
  cola = t.catch(() => {})
  return t
}

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
    const f = fichero(u)
    if (!REAL) {
      if (existsSync(f))
        return r.fulfill({ contentType: 'application/json', body: readFileSync(f) })
      faltan.push(u)
      return r.fulfill({ status: 503 })
    }
    const res = await turno(() => r.fetch())
    const cuerpo = await res.text()
    // En mantenimiento el Catastro responde 200 con XML: no se graba.
    if (GRABAR && res.ok() && esJson(cuerpo)) {
      mkdirSync(GRABACIONES, { recursive: true })
      writeFileSync(f, cuerpo)
    }
    return r.fulfill({ response: res, body: cuerpo })
  })
}

export interface Extension {
  context: BrowserContext
  /** Peticiones al Catastro sin grabación (modo grabado). */
  faltan: string[]
  /** Abre el anuncio y el panel fijado a su pestaña, a 360 px. */
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
