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
    const otro = inmueble({ m2: 200, planta: '05', anio: 1950, uso: 'Comercial' })
    expect(puntuar(completo, otro)).toBeCloseTo(0)
  })

  it('pesos: superficie 0,45, planta 0,30, año 0,15, uso 0,10', () => {
    const base = { m2: 200, planta: '05', anio: 1950, uso: 'Comercial' }
    expect(puntuar(completo, inmueble({ ...base, m2: 100 }))).toBeCloseTo(0.45)
    expect(puntuar(completo, inmueble({ ...base, planta: '01' }))).toBeCloseTo(0.3)
    expect(puntuar(completo, inmueble({ ...base, anio: 2000 }))).toBeCloseTo(0.15)
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
    [1998, true],
    [2002, true],
    [1997, false],
    [2003, false],
  ])('año %i frente a 2000 (±2) → coincide: %s', (anio, coincide) => {
    const p = puntuar(anuncio({ anio: 2000 }), inmueble({ anio, uso: 'x' }))
    expect(p > 0).toBe(coincide)
  })

  it('planta: normaliza anuncio y Catastro', () => {
    const a = anuncio({ planta: 'bajo' })
    expect(puntuar(a, inmueble({ planta: 'BJ', uso: 'x' }))).toBeCloseTo(0.75)
    expect(puntuar(a, inmueble({ planta: '00', uso: 'x' }))).toBeCloseTo(0.75)
    expect(puntuar(a, inmueble({ planta: '01', uso: 'x' }))).toBe(0)
    expect(puntuar(anuncio({ planta: 'ático' }), inmueble({ planta: 'AT', uso: 'x' }))).toBeCloseTo(
      0.75,
    )
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

  it('coords aproximadas → nunca alta', () => {
    expect(calcularConfianza(cands(1, 0), { coordsAproximadas: true })).toBe('media')
    expect(calcularConfianza(cands(0.5), { coordsAproximadas: true })).toBe('baja')
  })

  it('no depende del orden de entrada', () => {
    expect(calcularConfianza(cands(0.6, 0.9))).toBe('alta')
  })
})
