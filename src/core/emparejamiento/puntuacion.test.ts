import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Anuncio, Candidato, Inmueble } from '../tipos'
import { calcularConfianza, ordenarCandidatos, puntuar } from './puntuacion'

const anuncio = (datos: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '1',
  url: 'https://www.idealista.com/inmueble/1/',
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  ...datos,
})

const inmueble = (datos: Partial<Inmueble> = {}): Inmueble => ({
  rc: '0000000AA0000A0001AA',
  uso: 'Residencial',
  m2: 100,
  anio: 2000,
  planta: '01',
  puerta: 'A',
  direccion: '',
  ...datos,
})

const completo = anuncio({ m2Construidos: 100, planta: '1', anio: 2000 })

describe('puntuar', () => {
  it('todas las señales coinciden → 1', () => {
    expect(puntuar(completo, inmueble())).toBeCloseTo(1)
  })

  it('ninguna coincide → 0', () => {
    const otro = inmueble({ m2: 200, planta: '05', anio: 1992, uso: 'Comercial' })
    expect(puntuar(completo, otro)).toBeCloseTo(0)
  })

  it('pesos: superficie 0,45, planta 0,35, año 0,10, uso 0,10', () => {
    const base = { m2: 200, planta: '05', anio: 1992, uso: 'Comercial' }
    expect(puntuar(completo, inmueble({ ...base, m2: 100 }))).toBeCloseTo(0.45)
    expect(puntuar(completo, inmueble({ ...base, planta: '01' }))).toBeCloseTo(0.35)
    expect(puntuar(completo, inmueble({ ...base, anio: 2000 }))).toBeCloseTo(0.1)
    expect(puntuar(completo, inmueble({ ...base, uso: 'Residencial' }))).toBeCloseTo(0.1)
  })

  it.each([
    [85, true],
    [115, true],
    [84, false],
    [116, false],
  ])('superficie %i m² frente a 100 (±15 %%) → coincide: %s', (m2, coincide) => {
    const p = puntuar(anuncio({ m2Construidos: 100 }), inmueble({ m2, uso: 'Comercial' }))
    expect(p > 0).toBe(coincide)
  })

  it('solo útiles → se comparan útiles × 1,2', () => {
    const a = anuncio({ m2Utiles: 100 })
    expect(puntuar(a, inmueble({ m2: 120, uso: 'x' }))).toBeGreaterThan(0)
    expect(puntuar(a, inmueble({ m2: 138, uso: 'x' }))).toBeGreaterThan(0)
    expect(puntuar(a, inmueble({ m2: 139, uso: 'x' }))).toBe(0)
  })

  it('construidos tienen prioridad sobre útiles', () => {
    const a = anuncio({ m2Construidos: 100, m2Utiles: 100 })
    expect(puntuar(a, inmueble({ m2: 100, uso: 'x' }))).toBeGreaterThan(0)
  })

  it.each([
    [1995, 0.1],
    [2005, 0.1],
    [1994, 0],
    [2010, 0],
    [1990, 0],
    [2011, -0.1],
    [1989, -0.1],
  ])('año %i frente a 2000: ±5 suma, > 10 resta (%d)', (anio, obtenido) => {
    // Con superficie (0,45) para ver la resta.
    const a = anuncio({ m2Construidos: 100, anio: 2000 })
    expect(puntuar(a, inmueble({ anio, uso: 'x' }))).toBeCloseTo((0.45 + obtenido) / 0.65)
  })

  it('año sin dato en el Catastro (0) no resta', () => {
    const a = anuncio({ m2Construidos: 100, anio: 2000 })
    expect(puntuar(a, inmueble({ anio: 0, uso: 'x' }))).toBeCloseTo(0.45 / 0.65)
  })

  it('no baja de 0', () => {
    expect(puntuar(anuncio({ anio: 2000 }), inmueble({ anio: 1900, uso: 'x' }))).toBe(0)
  })

  it('planta: normaliza anuncio y Catastro', () => {
    const a = anuncio({ planta: 'bajo' })
    const p = 0.35 / 0.45
    expect(puntuar(a, inmueble({ planta: 'BJ', uso: 'x' }))).toBeCloseTo(p)
    expect(puntuar(a, inmueble({ planta: '00', uso: 'x' }))).toBeCloseTo(p)
    expect(puntuar(a, inmueble({ planta: '01', uso: 'x' }))).toBe(0)
    expect(puntuar(anuncio({ planta: 'ático' }), inmueble({ planta: 'AT', uso: 'x' }))).toBeCloseTo(
      p,
    )
  })

  it("ático sin planta → planta 'atico'", () => {
    const p = 0.35 / 0.45
    const a = anuncio({ tipo: 'atico' })
    expect(puntuar(a, inmueble({ planta: 'AT', uso: 'x' }))).toBeCloseTo(p)
    expect(puntuar(a, inmueble({ planta: '07', uso: 'x' }))).toBe(0)
    const conPlanta = anuncio({ tipo: 'atico', planta: '7' })
    expect(puntuar(conPlanta, inmueble({ planta: '07', uso: 'x' }))).toBeCloseTo(p)
  })

  it("planta 'otro' en el anuncio no puntúa ni penaliza", () => {
    expect(puntuar(anuncio({ planta: 'XX' }), inmueble({ planta: 'OD' }))).toBeCloseTo(1)
  })

  it('señales ausentes no puntúan ni penalizan: normaliza sobre las disponibles', () => {
    // Solo superficie + uso: 0,45 / 0,55
    const a = anuncio({ m2Construidos: 100 })
    expect(puntuar(a, inmueble({ uso: 'x' }))).toBeCloseTo(0.45 / 0.55)
    expect(puntuar(a, inmueble())).toBeCloseTo(1)
  })

  it('anuncio sin datos → solo cuenta el uso', () => {
    expect(puntuar(anuncio(), inmueble())).toBeCloseTo(1)
    expect(puntuar(anuncio(), inmueble({ uso: 'Comercial' }))).toBe(0)
  })

  it('uso residencial sin distinguir mayúsculas', () => {
    expect(puntuar(anuncio(), inmueble({ uso: 'RESIDENCIAL' }))).toBeCloseTo(1)
  })
})

describe('ordenarCandidatos', () => {
  it('puntúa y ordena de mayor a menor, sin descartar no residenciales', () => {
    const local = inmueble({ rc: 'local', uso: 'Comercial', planta: '00' })
    const malo = inmueble({ rc: 'malo', m2: 300, planta: '07', anio: 1900 })
    const bueno = inmueble({ rc: 'bueno' })
    const r = ordenarCandidatos(completo, [malo, local, bueno])
    expect(r.map((c) => c.inmueble.rc)).toEqual(['bueno', 'local', 'malo'])
    expect(r[0]?.puntuacion).toBeCloseTo(1)
  })

  it('sin inmuebles → []', () => {
    expect(ordenarCandidatos(completo, [])).toEqual([])
  })

  it('con planta en el anuncio, ninguno de otra planta queda por delante', () => {
    const otra = inmueble({ rc: 'otra', planta: '05' })
    const misma = inmueble({ rc: 'misma', m2: 300, anio: 1900, uso: 'x' })
    const r = ordenarCandidatos(completo, [otra, misma])
    expect(r.map((c) => c.inmueble.rc)).toEqual(['misma', 'otra'])
  })

  it('a igual puntuación, primero el más cercano; sin distancia, al final', () => {
    const a = inmueble({ rc: 'a' })
    const b = inmueble({ rc: 'b' })
    const c = inmueble({ rc: 'c' })
    const distancias = new Map([
      [a, 200],
      [b, 3],
    ])
    const r = ordenarCandidatos(completo, [c, a, b], distancias)
    expect(r.map((x) => [x.inmueble.rc, x.distancia])).toEqual([
      ['b', 3],
      ['a', 200],
      ['c', undefined],
    ])
  })

  it('caso 111109550: el 2.º de 176 m² y 1935 no gana a los del 5.º', () => {
    const a: Anuncio = JSON.parse(
      readFileSync('fixtures/idealista/esperado/111109550.json', 'utf8'),
    )
    const segunda = inmueble({ rc: 'segunda', planta: '02', m2: 176, anio: 1935 })
    const quinta = inmueble({ rc: 'quinta', planta: '05', m2: 188, anio: 1939 })
    const quintaPequena = inmueble({ rc: 'quintaPequena', planta: '05', m2: 140, anio: 1939 })
    const r = ordenarCandidatos(a, [segunda, quintaPequena, quinta])
    expect(r.map((c) => c.inmueble.rc)).toEqual(['quinta', 'quintaPequena', 'segunda'])
    // Superficie 0,45 + uso 0,10 − año 0,10.
    expect(r[2]?.puntuacion).toBeCloseTo(0.45)
  })
})

const cands = (...ps: number[]): Candidato[] =>
  ps.map((puntuacion) => ({ inmueble: inmueble(), puntuacion }))

describe('calcularConfianza', () => {
  it('sin candidatos → ninguna', () => {
    expect(calcularConfianza([])).toBe('ninguna')
  })

  it('1.º ≥ 0,8 y ventaja ≥ 0,2 → alta', () => {
    expect(calcularConfianza(cands(0.8, 0.6))).toBe('alta')
    expect(calcularConfianza(cands(1, 0.8))).toBe('alta')
    expect(calcularConfianza(cands(0.9))).toBe('alta')
  })

  it('ventaja < 0,2 → media', () => {
    expect(calcularConfianza(cands(0.8, 0.61))).toBe('media')
    expect(calcularConfianza(cands(1, 1))).toBe('media')
  })

  it('umbral 0,8', () => {
    expect(calcularConfianza(cands(0.79, 0))).toBe('media')
  })

  it('umbral 0,6', () => {
    expect(calcularConfianza(cands(0.6))).toBe('media')
    expect(calcularConfianza(cands(0.59))).toBe('baja')
    expect(calcularConfianza(cands(0))).toBe('baja')
  })

  it('media: ventaja ≥ 0,1 o ≤ 3 empatados en cabeza; si no, baja', () => {
    expect(calcularConfianza(cands(0.7, 0.6, 0.6, 0.6))).toBe('media')
    expect(calcularConfianza(cands(0.7, 0.7, 0.7, 0.5))).toBe('media')
    expect(calcularConfianza(cands(0.7, 0.65, 0.65, 0.65))).toBe('media')
    expect(calcularConfianza(cands(0.7, 0.7, 0.7, 0.7, 0.5))).toBe('baja')
    expect(calcularConfianza(cands(0.7, 0.7, 0.7, 0.7))).toBe('baja')
    expect(calcularConfianza(cands(1, 1, 1, 1))).toBe('baja')
  })

  it('coords aproximadas → nunca alta', () => {
    expect(calcularConfianza(cands(1, 0), { coordsAproximadas: true })).toBe('media')
    expect(calcularConfianza(cands(0.5), { coordsAproximadas: true })).toBe('baja')
  })

  it('respeta el orden dado (otra planta va detrás aunque puntúe más)', () => {
    expect(calcularConfianza(cands(0.85, 0.9))).toBe('media')
  })
})
