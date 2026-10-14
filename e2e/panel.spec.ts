import type { Page } from '@playwright/test'
import { expect, test, urlAnuncio } from './extension'

/** Espera a que el panel termine de consultar. */
async function listo(panel: Page) {
  await expect(panel.locator('#app[aria-busy="false"]')).toBeAttached({ timeout: 60_000 })
  await expect(panel.locator('#app h2, #app .vacio').first()).toBeVisible()
}

const sello = (panel: Page) => panel.locator('.sello')
const capturar = (panel: Page, nombre: string) =>
  panel.screenshot({ path: `e2e/capturas/${nombre}.png`, fullPage: true })

test.afterEach(({ ext }) => expect(ext.faltan).toEqual([]))

test('muestra inmueble, discrepancias, gastos y siguientes pasos', async ({ ext }) => {
  const { panel } = await ext.abrir('104570830')
  await listo(panel)
  for (const s of ['Inmueble', 'Anuncio frente a Catastro', 'Gastos de compra', 'Siguientes pasos'])
    await expect(panel.getByRole('heading', { name: s })).toBeVisible()
  await expect(sello(panel)).toContainText('Sin confirmar')
})

test('"Es este" confirma y persiste al recargar', async ({ ext }) => {
  const { anuncio, panel } = await ext.abrir('111109550')
  await listo(panel)
  await panel.getByRole('button', { name: 'Es este' }).nth(1).click()
  await expect(sello(panel)).toHaveText('Confirmado por ti')
  await expect(panel.getByRole('heading', { name: 'Inmueble' })).toBeFocused()
  await anuncio.reload()
  await panel.reload()
  await listo(panel)
  await expect(sello(panel)).toHaveText('Confirmado por ti')
  await capturar(panel, 'confirmado')
})

test('búsqueda guiada: calle → número → planta y puerta', async ({ ext }) => {
  const { panel } = await ext.abrir('111955729')
  await listo(panel)
  await panel.getByText('Buscar por calle y número').click()
  await panel.getByRole('button', { name: 'Ver números' }).click()
  await expect(panel.getByText('Elige el número:')).toBeVisible({ timeout: 30_000 })
  await panel.locator('.numeros button').first().click()
  await expect(panel.getByText(/elige planta y puerta/)).toBeVisible({ timeout: 30_000 })
  await capturar(panel, 'busqueda')
  await panel.locator('details .lista').getByRole('button', { name: 'Es este' }).first().click()
  await expect(sello(panel)).toHaveText('Confirmado por ti', { timeout: 30_000 })
})

test('pegar RC inválida avisa; válida confirma', async ({ ext }) => {
  const { panel } = await ext.abrir('104685725')
  await listo(panel)
  const rc = panel.locator('.rc').first()
  const valida = (await rc.textContent()) ?? ''
  await panel.getByText('Pegar referencia catastral').click()
  const campo = panel.getByLabel('Referencia catastral (20 caracteres)')
  await campo.fill('1234')
  await panel.getByRole('button', { name: 'Usar' }).click()
  await expect(panel.getByRole('alert').filter({ hasText: '20 letras o números' })).toBeVisible()
  await capturar(panel, 'rc-invalida')
  await campo.fill(valida)
  await panel.getByRole('button', { name: 'Usar' }).click()
  await expect(sello(panel)).toHaveText('Confirmado por ti', { timeout: 30_000 })
})

test('cambiar de anuncio en la pestaña repinta el panel', async ({ ext }) => {
  const { anuncio, panel } = await ext.abrir('108505570')
  await listo(panel)
  const antes = await panel.locator('.rc').first().textContent()
  await anuncio.goto(urlAnuncio('110258143'))
  await expect(panel.locator('.rc').first()).not.toHaveText(antes ?? '', { timeout: 60_000 })
  await listo(panel)
  await capturar(panel, 'cambio-anuncio')
})
