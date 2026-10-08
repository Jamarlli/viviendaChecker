import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Anuncio, Emparejamiento, Gastos } from './tipos'

describe('tipos', () => {
  it('Anuncio admite campos opcionales ausentes', () => {
    const a: Anuncio = {
      portal: 'idealista',
      id: '1',
      url: 'https://www.idealista.com/inmueble/1/',
      obraNueva: false,
      descripcion: '',
      mencionaTrastero: false,
      mencionaGaraje: false,
    }
    expect(a.precio).toBeUndefined()
  })

  it('Emparejamiento sin candidatos', () => {
    const e = { candidatos: [], confianza: 'ninguna', origen: 'direccion' } satisfies Emparejamiento
    expect(e.candidatos).toHaveLength(0)
  })

  it('Gastos con rangos', () => {
    expectTypeOf<Gastos['total']>().toEqualTypeOf<{ min: number; max: number }>()
  })
})
