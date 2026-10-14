import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emparejar } from '../../core/emparejamiento/flujo'
import type { Almacen } from '../../core/emparejamiento/puertos'
import type { Anuncio } from '../../core/tipos'
import { crearClienteCatastro } from './cliente'

// Core + cliente real sobre respuestas grabadas del Catastro.

const fixture = (nombre: string) => readFileSync(`fixtures/catastro/${nombre}.json`, 'utf8')

type Rutas = { dnploc?: string; rccoor?: string; dnprc?: (refCat: string) => string }

function catastroFalso(rutas: Rutas, { caido = false } = {}) {
  const urls: URL[] = []
  const fn = async (u: string | URL | Request) => {
    const url = new URL(String(u))
    urls.push(url)
    if (caido) throw new Error('Failed to fetch')
    const op = url.pathname.split('/').pop()
    const nombre =
      op === 'Consulta_DNPLOC'
        ? rutas.dnploc
        : op === 'Consulta_RCCOOR_Distancia'
          ? rutas.rccoor
          : rutas.dnprc?.(url.searchParams.get('RefCat') ?? '')
    return new Response(fixture(nombre ?? 'dnprc-error'))
  }
  return { catastro: crearClienteCatastro(fn as typeof fetch), urls }
}

const sinSeleccion: Almacen = { leer: async () => undefined, guardar: async () => {} }

const anuncio = (datos: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '42',
  url: 'https://www.idealista.com/inmueble/42/',
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  ...datos,
})

// Alcalá 100: el 0017 es el único de 126 m² (3.º CD).
const RC_3CD = '2853604VK4725D0017LM'
const datos3CD = { m2Construidos: 126, planta: '3', anio: 1930 }
const alcala100 = anuncio({
  ...datos3CD,
  direccion: { via: 'Calle de Alcalá', numero: '100' },
  municipio: 'Madrid',
  provincia: 'Madrid',
})
const centro = { lat: 40.415, lon: -3.705 }
// Fixture de Alcalá 100 servida como si fuera la parcela más cercana.
const dnprcParcela = (rc: string) => (rc === '0343111VK4704C' ? 'dnprc-parcela' : 'dnprc-error')

const parametros = (u: URL | undefined) => Object.fromEntries(u?.searchParams ?? [])

describe('emparejamiento con el Catastro (fixtures)', () => {
  it('dirección exacta y datos completos → alta y RC correcta', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios' })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: sinSeleccion })
    expect(parametros(c.urls[0])).toMatchObject({ Sigla: 'CL', Calle: 'ALCALA', Numero: '100' })
    if (!r.ok) throw new Error()
    expect(r.valor.confianza).toBe('alta')
    expect(r.valor.candidatos[0]?.inmueble.rc).toBe(RC_3CD)
    expect(r.valor.candidatos).toHaveLength(34)
  })

  it('Barcelona: "Carrer de Mallorca" → CL MALLORCA', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-barcelona-mallorca' })
    const a = anuncio({
      direccion: { via: 'Carrer de Mallorca', numero: '100' },
      municipio: 'Barcelona',
      provincia: 'Barcelona',
      m2Construidos: 143,
      planta: '1',
    })
    const r = await emparejar(a, { catastro: c.catastro, almacen: sinSeleccion })
    expect(parametros(c.urls[0])).toMatchObject({ Sigla: 'CL', Calle: 'MALLORCA', Numero: '100' })
    if (!r.ok) throw new Error()
    expect(r.valor.candidatos).toHaveLength(35)
    expect(r.valor.candidatos[0]).toMatchObject({ inmueble: { planta: '01' }, puntuacion: 1 })
  })

  it('Santiago: "Rúa do Vilar" → RU VILAR', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-santiago-rua' })
    const a = anuncio({
      direccion: { via: 'Rúa do Vilar', numero: '1' },
      municipio: 'Santiago de Compostela',
      provincia: 'A Coruña',
    })
    const r = await emparejar(a, { catastro: c.catastro, almacen: sinSeleccion })
    expect(parametros(c.urls[0])).toMatchObject({ Sigla: 'RU', Calle: 'VILAR', Numero: '1' })
    expect(r.ok && r.valor.candidatos).toHaveLength(1)
  })

  it('coords: parcelas cercanas; las que fallan se descartan', async () => {
    const c = catastroFalso({
      rccoor: 'rccoor-varias',
      dnprc: (rc) => (rc === '0342202VK4704A' ? 'dnprc-rc-invalida' : dnprcParcela(rc)),
    })
    const a = anuncio({ ...datos3CD, coords: { ...centro, aproximada: false } })
    const r = await emparejar(a, { catastro: c.catastro, almacen: sinSeleccion })
    expect(c.urls).toHaveLength(11)
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('coords')
    expect(r.valor.candidatos[0]?.inmueble.rc).toBe(RC_3CD)
    expect(r.valor.confianza).toBe('alta')
  })

  it('Catastro caído → error de red, sin lanzar', async () => {
    const c = catastroFalso({}, { caido: true })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: sinSeleccion })
    expect(r).toMatchObject({ ok: false, error: { tipo: 'red' } })
  })

  it('provincia foral → noSoportado', async () => {
    const c = catastroFalso({})
    const a = { ...alcala100, provincia: 'Bizkaia', coords: { ...centro, aproximada: false } }
    const r = await emparejar(a, { catastro: c.catastro, almacen: sinSeleccion })
    expect(r).toEqual({ ok: false, error: { tipo: 'noSoportado' } })
    expect(c.urls).toEqual([])
  })
})
