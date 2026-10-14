import { describe, expect, it } from 'vitest'
import { NOTA_GASTOS } from '../gastos'
import type { Candidato, Discrepancia, Emparejamiento } from '../tipos'
import type { Analisis } from './analisis'
import { anuncio, inmueble } from './falsos'
import {
  enlaces,
  etiquetaInmueble,
  euros,
  mensajeError,
  notasGastos,
  ordenarDiscrepancias,
  textoPlanta,
  textoRango,
  vistaInmueble,
} from './vista'

const sinNbsp = (s: string) => s.replace(/\s/g, ' ')

const analisis = (e?: Partial<Emparejamiento>, datos: Partial<Analisis> = {}): Analisis => ({
  anuncio: anuncio(),
  emparejamiento: e && { candidatos: [], confianza: 'ninguna', origen: 'direccion', ...e },
  discrepancias: [],
  alertas: [],
  gastos: null,
  ...datos,
})

const cand = (rc: string, puntuacion: number): Candidato => ({
  inmueble: inmueble(rc, { planta: '03', puerta: 'CD', m2: 126, anio: 1930 }),
  puntuacion,
})

describe('textoPlanta', () => {
  it.each([
    ['03', 'Planta 3'],
    ['00', 'Bajo'],
    ['BJ', 'Bajo'],
    ['AT', 'Ático'],
    ['-1', 'Sótano'],
    ['EN', 'Entreplanta'],
    ['OD', 'OD'],
    ['', ''],
  ])('%s → %s', (p, t) => expect(textoPlanta(p)).toBe(t))
})

describe('etiquetaInmueble', () => {
  it('planta, puerta, m², uso y año', () => {
    expect(etiquetaInmueble(cand('X', 1).inmueble)).toBe(
      'Planta 3 · Puerta CD · 126 m² · Residencial · 1930',
    )
  })

  it('omite lo que falta', () => {
    expect(etiquetaInmueble(inmueble('X', { planta: '', puerta: '', anio: 0, m2: 0 }))).toBe(
      'Residencial',
    )
  })
})

describe('vistaInmueble', () => {
  it('candidato automático, aunque sea de confianza alta → sin confirmar', () => {
    const v = vistaInmueble(
      analisis({ candidatos: [cand('A', 0.9), cand('B', 0.4)], confianza: 'alta' }),
    )
    expect(v).toMatchObject({
      estado: 'sinConfirmar',
      rc: 'A',
      confianza: 'Confianza alta',
      candidatos: [
        { rc: 'A', coincidencia: '90 %' },
        { rc: 'B', coincidencia: '40 %' },
      ],
    })
  })

  it('máximo 10 candidatos', () => {
    const muchos = Array.from({ length: 15 }, (_, i) => cand(`R${i}`, 0.5))
    const v = vistaInmueble(analisis({ candidatos: muchos, confianza: 'baja' }))
    expect(v.estado === 'sinConfirmar' && v.candidatos).toHaveLength(10)
  })

  it('origen manual → confirmado, sin lista de candidatos', () => {
    const v = vistaInmueble(
      analisis({ candidatos: [cand('A', 1)], confianza: 'alta', origen: 'manual' }),
    )
    expect(v).toMatchObject({ estado: 'confirmado', rc: 'A', candidatos: [] })
  })

  it('sin candidatos', () => {
    expect(vistaInmueble(analisis({})).estado).toBe('sinCandidatos')
  })

  it('error del Catastro', () => {
    const v = vistaInmueble(analisis(undefined, { error: { tipo: 'red', mensaje: 'x' } }))
    expect(v).toEqual({ estado: 'error', mensaje: mensajeError({ tipo: 'red', mensaje: 'x' }) })
  })
})

describe('mensajeError', () => {
  it('foral', () => {
    expect(mensajeError({ tipo: 'noSoportado' })).toMatch(/País Vasco y Navarra/)
  })
  it('red', () => {
    expect(mensajeError({ tipo: 'red', mensaje: 'x' })).toMatch(/No se pudo conectar/)
  })
  it('api, con el mensaje del Catastro', () => {
    expect(mensajeError({ tipo: 'api', mensaje: 'FALLO' })).toMatch(/FALLO/)
  })
})

describe('ordenarDiscrepancias', () => {
  it('avisos, revisar, ok', () => {
    const d = (nivel: Discrepancia['nivel']): Discrepancia => ({
      campo: 'anio',
      nivel,
      explicacion: '',
    })
    expect(ordenarDiscrepancias([d('ok'), d('aviso'), d('revisar')]).map((x) => x.nivel)).toEqual([
      'aviso',
      'revisar',
      'ok',
    ])
  })
})

describe('importes', () => {
  it('euros sin decimales y con separador de miles', () => {
    expect(sinNbsp(euros(12000))).toBe('12.000 €')
    expect(sinNbsp(euros(1500.4))).toBe('1.500 €')
  })

  it('rango', () => {
    expect(sinNbsp(textoRango({ min: 600, max: 900 }))).toBe('600 € – 900 €')
    expect(sinNbsp(textoRango({ min: 12000, max: 12000 }))).toBe('12.000 €')
  })

  it('notas: la fija y la de la comunidad', () => {
    const g = { comunidad: 'Canarias', desglose: [], total: { min: 0, max: 0 } }
    expect(notasGastos(g)).toEqual([NOTA_GASTOS])
    expect(notasGastos({ ...g, nota: 'IGIC reducido' })).toEqual([NOTA_GASTOS, 'IGIC reducido'])
  })
})

describe('enlaces', () => {
  it('Sede del Catastro con la RC y nota simple', () => {
    const [sede, nota] = enlaces('2853604VK4725D0017LM')
    expect(sede?.url).toContain('RefC=2853604VK4725D0017LM')
    expect(new URL(sede?.url ?? '').hostname).toBe('www1.sedecatastro.gob.es')
    expect(nota?.url).toBe('https://sede.registradores.org/')
  })
})
