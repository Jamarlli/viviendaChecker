import { describe, expect, it } from 'vitest'
import { anuncio } from '../../core/panel/falsos'
import { crearAlmacen, crearSesion, type Area } from './almacenes'

function areaFalsa() {
  const datos = new Map<string, unknown>()
  const area: Area = {
    get: async (k) => (datos.has(k) ? { [k]: datos.get(k) } : {}),
    set: async (d) => Object.entries(d).forEach(([k, v]) => datos.set(k, v)),
    remove: async (k) => void datos.delete(k),
  }
  return { area, datos }
}

describe('crearAlmacen', () => {
  it('guarda y lee la selección por id de anuncio', async () => {
    const { area, datos } = areaFalsa()
    const a = crearAlmacen(area)
    expect(await a.leer('42')).toBeUndefined()
    await a.guardar('42', { rc: 'X' })
    expect(await a.leer('42')).toEqual({ rc: 'X' })
    expect([...datos]).toEqual([['seleccion:42', { rc: 'X' }]])
  })
})

describe('crearSesion', () => {
  it('guarda, lee y borra el anuncio por pestaña', async () => {
    const { area } = areaFalsa()
    const s = crearSesion(area)
    await s.guardar(3, anuncio())
    expect((await s.leer(3))?.id).toBe('42')
    await s.borrar(3)
    expect(await s.leer(3)).toBeUndefined()
  })
})
