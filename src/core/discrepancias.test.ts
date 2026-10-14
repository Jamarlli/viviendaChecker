import { describe, expect, it } from 'vitest'
import { discrepancias } from './discrepancias'
import type { Anuncio, Inmueble } from './tipos'

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

const inmueble = (i: Partial<Inmueble> = {}): Inmueble => ({
  rc: '0000000AA0000A0001AA',
  uso: 'Residencial',
  m2: 100,
  anio: 2000,
  planta: '01',
  puerta: 'A',
  direccion: 'CL MAYOR 1',
  ...i,
})

const de = (a: Anuncio, i = inmueble(), parcela: Inmueble[] = []) =>
  discrepancias(a, i, 'alta', parcela)
const nivel = (a: Anuncio, campo: string, i = inmueble(), parcela: Inmueble[] = []) =>
  de(a, i, parcela).find((d) => d.campo === campo)?.nivel

describe('superficie construida', () => {
  it.each([
    [110, 'ok'],
    [90, 'ok'],
    [111, 'revisar'],
    [120, 'revisar'],
    [80, 'revisar'],
    [121, 'aviso'],
    [79, 'aviso'],
  ])('%i m² frente a 100 → %s', (m2, esperado) => {
    expect(nivel(anuncio({ m2Construidos: m2 }), 'superficie')).toBe(esperado)
  })

  it('muestra ambos valores', () => {
    const d = de(anuncio({ m2Construidos: 90 }))[0]
    expect(d).toMatchObject({ anuncio: '90 m²', catastro: '100 m²' })
    expect(d?.explicacion).toBeTruthy()
  })

  it('aviso con explicación propia', () => {
    const revisar = de(anuncio({ m2Construidos: 115 }))[0]?.explicacion
    const aviso = de(anuncio({ m2Construidos: 130 }))[0]?.explicacion
    expect(aviso).toBeTruthy()
    expect(aviso).not.toBe(revisar)
  })

  it('prevalece sobre la útil', () => {
    expect(nivel(anuncio({ m2Construidos: 100, m2Utiles: 50 }), 'superficie')).toBe('ok')
  })
})

describe('superficie solo útil', () => {
  it.each([
    [100, 'ok'],
    [70, 'ok'],
    [101, 'revisar'],
    [69, 'revisar'],
  ])('%i m² útiles frente a 100 → %s', (m2, esperado) => {
    expect(nivel(anuncio({ m2Utiles: m2 }), 'superficie')).toBe(esperado)
  })
})

describe('año', () => {
  it.each([
    [2002, 'ok'],
    [1998, 'ok'],
    [2003, 'revisar'],
    [1997, 'revisar'],
  ])('%i frente a 2000 → %s', (anio, esperado) => {
    expect(nivel(anuncio({ anio }), 'anio')).toBe(esperado)
  })
})

describe('uso', () => {
  it('residencial → ok', () => {
    expect(nivel(anuncio({ tipo: 'piso' }), 'uso')).toBe('ok')
  })

  it('no residencial y anuncio de vivienda → aviso', () => {
    expect(nivel(anuncio({ tipo: 'piso' }), 'uso', inmueble({ uso: 'Comercial' }))).toBe('aviso')
  })

  it('no residencial y anuncio no de vivienda → no se evalúa', () => {
    expect(nivel(anuncio({ tipo: 'otro' }), 'uso', inmueble({ uso: 'Comercial' }))).toBeUndefined()
  })
})

describe('planta', () => {
  it.each([
    ['1', '01', 'ok'],
    ['bajo', '00', 'ok'],
    ['bajo', 'BJ', 'ok'],
    ['2', '01', 'revisar'],
    ['atico', 'AT', 'ok'],
    ['1', 'OD', 'revisar'],
  ])('anuncio %s, catastro %s → %s', (p, c, esperado) => {
    expect(nivel(anuncio({ planta: p }), 'planta', inmueble({ planta: c }))).toBe(esperado)
  })
})

it('planta del anuncio desconocida → no se evalúa', () => {
  expect(nivel(anuncio({ planta: 'xx' }), 'planta', inmueble({ planta: 'OD' }))).toBeUndefined()
})

describe('superficie con garaje o trastero sumados', () => {
  const vivienda = (m2: number) => inmueble({ rc: '1111111AA1111A0001AA', m2 })
  const plaza = (m2: number) =>
    inmueble({ rc: '1111111AA1111A0002BB', m2, uso: 'Almacen-Estacionamiento' })
  const a = anuncio({ m2Construidos: 194, mencionaGaraje: true, garaje: 'incluido' })
  const sup = (an: Anuncio, v: Inmueble, parcela: Inmueble[] = []) =>
    de(an, v, parcela).find((d) => d.campo === 'superficie')
  const GARAJE = 'El anuncio puede estar sumando el garaje/trastero'

  it('> 20 % que se explica con la plaza de la parcela → revisar, sin anexo duplicado', () => {
    const d = de(a, vivienda(150), [vivienda(150), plaza(40)])
    expect(d.find((x) => x.campo === 'superficie')).toMatchObject({ nivel: 'revisar' })
    expect(d.find((x) => x.campo === 'superficie')?.explicacion).toContain(GARAJE)
    expect(d.some((x) => x.campo === 'anexo')).toBe(false)
  })

  it('sin plaza conocida, con el rango 20–35 m² (±5 %)', () => {
    expect(sup(a, vivienda(150))?.nivel).toBe('revisar')
    expect(sup(a, vivienda(120))?.nivel).toBe('aviso')
  })

  it('10–20 % explicado → misma explicación', () => {
    expect(sup(a, vivienda(170), [plaza(25)])?.explicacion).toContain(GARAJE)
  })

  it('el anexo debe cubrir lo que pasa del 10 %: anuncio 112, vivienda 100, trastero 2 → no', () => {
    const d = sup(anuncio({ m2Construidos: 112, trastero: true }), vivienda(100), [plaza(2)])
    expect(d?.nivel).toBe('revisar')
    expect(d?.explicacion).not.toContain(GARAJE)
  })

  it('mención sin garaje incluido ni trastero en básicas → aviso', () => {
    const solo = anuncio({ m2Construidos: 194, mencionaGaraje: true })
    expect(sup(solo, vivienda(150), [plaza(40)])?.nivel).toBe('aviso')
  })
})

describe('anexo', () => {
  const almacen = inmueble({ rc: '0000000AA0000A0002BB', uso: 'Almacen-Estacionamiento' })

  it('menciona trastero y la parcela tiene almacenes → revisar', () => {
    expect(nivel(anuncio({ mencionaTrastero: true }), 'anexo', inmueble(), [almacen])).toBe(
      'revisar',
    )
  })

  it('menciona garaje y la parcela tiene estacionamientos → revisar', () => {
    expect(nivel(anuncio({ mencionaGaraje: true }), 'anexo', inmueble(), [almacen])).toBe('revisar')
  })

  it('ambos anexos → frase en plural', () => {
    const d = de(anuncio({ mencionaTrastero: true, mencionaGaraje: true }), inmueble(), [almacen])
    expect(d[0]?.explicacion).toContain('el trastero y el garaje entran en la venta')
  })

  it('sin mención → no se evalúa', () => {
    expect(nivel(anuncio(), 'anexo', inmueble(), [almacen])).toBeUndefined()
  })

  it('parcela sin almacenes → no se evalúa', () => {
    expect(
      nivel(anuncio({ mencionaTrastero: true }), 'anexo', inmueble(), [inmueble()]),
    ).toBeUndefined()
  })
})

describe('sin dato', () => {
  it('anuncio vacío → nada', () => {
    expect(de(anuncio())).toEqual([])
  })
})

describe('confianza', () => {
  const a = anuncio({ m2Construidos: 100, anio: 2000 })

  it('baja → poco fiable', () => {
    const r = discrepancias(a, inmueble(), 'baja', [])
    expect(r).toHaveLength(2)
    expect(r.every((d) => d.pocoFiable)).toBe(true)
  })

  it('ninguna → poco fiable', () => {
    expect(discrepancias(a, inmueble(), 'ninguna', []).every((d) => d.pocoFiable)).toBe(true)
  })

  it('media → fiable', () => {
    expect(discrepancias(a, inmueble(), 'media', []).some((d) => d.pocoFiable)).toBe(false)
  })

  it('alta → fiable', () => {
    expect(de(a).some((d) => d.pocoFiable)).toBe(false)
  })
})
