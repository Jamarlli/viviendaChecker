import { describe, expect, it } from 'vitest'
import datos from '../../data/impuestos.json'
import { calcularGastos, NOTA_GASTOS, type TablaImpuestos } from './gastos'

const tabla = datos as TablaImpuestos
import type { Anuncio, ConceptoGasto } from './tipos'

const anuncio = (a: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '1',
  url: 'https://www.idealista.com/inmueble/1/',
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  ...a,
})

const calcula = (precio: number, provincia: string, obraNueva = false) =>
  calcularGastos(anuncio({ precio, provincia, obraNueva }), tabla)

const partida = (precio: number, provincia: string, concepto: ConceptoGasto, obraNueva = false) =>
  calcula(precio, provincia, obraNueva)?.desglose.find((p) => p.concepto === concepto)?.importe

describe('calcularGastos', () => {
  it('sin precio o sin provincia → null', () => {
    expect(calcularGastos(anuncio({ provincia: 'Madrid' }), tabla)).toBeNull()
    expect(calcularGastos(anuncio({ precio: 200000 }), tabla)).toBeNull()
  })

  it('provincia desconocida → null', () => {
    expect(calcula(200000, 'Narnia')).toBeNull()
  })

  it.each([
    ['Madrid', 'Comunidad de Madrid'],
    ['málaga', 'Andalucía'],
    ['MALAGA', 'Andalucía'],
    ['Lérida', 'Cataluña'],
    ['Alicante/Alacant', 'Comunitat Valenciana'],
    ['Coruña (A)', 'Galicia'],
    ['Baleares', 'Illes Balears'],
    ['  Avila ', 'Castilla y León'],
    ['Vizcaya', 'País Vasco'],
    ['Ceuta', 'Ceuta'],
    ['Melilla', 'Melilla'],
  ])('provincia %s → %s', (provincia, comunidad) => {
    expect(calcula(200000, provincia)?.comunidad).toBe(comunidad)
  })

  it('segunda mano: ITP + notaría, registro y gestoría, con total', () => {
    const g = calcula(200000, 'Madrid')
    expect(g?.desglose).toEqual([
      { concepto: 'itp', importe: { min: 12000, max: 12000 } },
      { concepto: 'notaria', importe: { min: 600, max: 1200 } },
      { concepto: 'registro', importe: { min: 400, max: 800 } },
      { concepto: 'gestoria', importe: { min: 300, max: 500 } },
    ])
    expect(g?.total).toEqual({ min: 13300, max: 14500 })
  })

  it('obra nueva: IVA 10 % + AJD, sin ITP', () => {
    const g = calcula(300000, 'Madrid', true)
    const conceptos = g?.desglose.map((p) => p.concepto)
    expect(conceptos).toEqual(['iva', 'ajd', 'notaria', 'registro', 'gestoria'])
    expect(partida(300000, 'Madrid', 'iva', true)).toEqual({ min: 30000, max: 30000 })
    expect(partida(300000, 'Madrid', 'ajd', true)).toEqual({ min: 2250, max: 2250 })
  })

  it.each([
    ['Las Palmas', 'igic', 14000],
    ['Tenerife', 'igic', 14000],
    ['Ceuta', 'ipsi', 8000],
    ['Melilla', 'ipsi', 8000],
  ] as const)(
    'obra nueva en %s: %s en lugar de IVA, con AJD y nota',
    (provincia, concepto, importe) => {
      const g = calcula(200000, provincia, true)
      expect(g?.desglose.map((p) => p.concepto)).toEqual([
        concepto,
        'ajd',
        'notaria',
        'registro',
        'gestoria',
      ])
      expect(partida(200000, provincia, concepto, true)).toEqual({ min: importe, max: importe })
      expect(g?.nota).toMatch(/VPO/)
    },
  )

  it('obra nueva en Canarias: la nota avisa del tipo reducido por vivienda habitual', () => {
    expect(calcula(200000, 'Las Palmas', true)?.nota).toMatch(/vivienda habitual/)
  })

  it('sin nota fuera de Canarias, Ceuta y Melilla o en segunda mano', () => {
    expect(calcula(200000, 'Madrid', true)?.nota).toBeUndefined()
    expect(calcula(200000, 'Ceuta')?.nota).toBeUndefined()
  })

  describe('ITP marginal', () => {
    it.each([
      // Cataluña: 10 % hasta 600k, 11 % hasta 900k, 12 % hasta 1,5M, 13 % resto
      [600000, 60000],
      [600001, 60000.11],
      [900000, 93000],
      [1000000, 105000],
      [2000000, 230000],
    ])('Cataluña %s → %s', (precio, itp) => {
      expect(partida(precio, 'Barcelona', 'itp')?.min).toBeCloseTo(itp, 2)
    })

    it.each([
      // Castilla y León: 8 % hasta 250k, 10 % resto
      [250000, 20000],
      [250001, 20000.1],
      [300000, 25000],
    ])('Castilla y León %s → %s', (precio, itp) => {
      expect(partida(precio, 'Valladolid', 'itp')?.min).toBeCloseTo(itp, 2)
    })
  })

  describe('ITP total', () => {
    it.each([
      // C. Valenciana: 9 % hasta 1M; por encima, todo al 11 %
      [1000000, 90000],
      [1000001, 110000.11],
    ])('C. Valenciana %s → %s', (precio, itp) => {
      expect(partida(precio, 'Valencia', 'itp')?.min).toBeCloseTo(itp, 2)
    })

    it.each([
      // Asturias: 8 % hasta 300k, 9 % hasta 500k, 10 % resto; todo al tipo del tramo
      [300000, 24000],
      [300001, 27000.09],
      [400000, 36000],
    ])('Asturias %s → %s', (precio, itp) => {
      expect(partida(precio, 'Asturias', 'itp')?.min).toBeCloseTo(itp, 2)
    })
  })

  it('nota fija de la spec', () => {
    expect(NOTA_GASTOS).toBe(
      'Tipo general. Puede haber tipos reducidos (jóvenes, familia numerosa…) y la base puede ser el valor de referencia si es mayor que el precio.',
    )
  })
})
