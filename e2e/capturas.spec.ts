// Captura el panel de cada anuncio (360 px, claro y oscuro) en e2e/capturas/ para revisarlo a ojo.
import { readdirSync } from 'node:fs'
import { expect, test } from './extension'

const ANUNCIOS = readdirSync('fixtures/idealista')
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace('.html', ''))

test.afterEach(({ ext }) => expect(ext.faltan).toEqual([]))

for (const id of ANUNCIOS) {
  test(`captura ${id}`, async ({ ext }) => {
    const { anuncio, panel } = await ext.abrir(id)
    await expect(panel.locator('#app[aria-busy="false"]')).toBeAttached({ timeout: 60_000 })
    await expect(panel.locator('#app h2, #app .vacio').first()).toBeVisible()
    for (const tema of ['light', 'dark'] as const) {
      await panel.emulateMedia({ colorScheme: tema })
      await panel.screenshot({ path: `e2e/capturas/${id}-${tema}.png`, fullPage: true })
    }
    // Sin desbordamiento horizontal a 360 px.
    expect(await panel.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    )
    await anuncio.close()
    await panel.close()
  })
}
