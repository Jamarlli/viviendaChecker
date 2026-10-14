import type {
  ClienteCatastro,
  Localizacion,
  Parcela,
  Resultado,
} from '../../core/emparejamiento/puertos'
import type { Inmueble } from '../../core/tipos'

export type {
  ErrorCatastro,
  Localizacion,
  Parcela,
  Resultado,
} from '../../core/emparejamiento/puertos'

const BASE = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/'
const CALLEJERO = `${BASE}COVCCallejero.svc/json/`
const COORDENADAS = `${BASE}COVCCoordenadas.svc/json/`

// Códigos OVC que significan "no encontrado", no avería.
const SIN_RESULTADOS = new Set(['5', '33', '43'])

const FORALES = new Set([
  'ALAVA',
  'ARABA',
  'BIZKAIA',
  'VIZCAYA',
  'GIPUZKOA',
  'GUIPUZCOA',
  'NAVARRA',
  'NAFARROA',
])

export function esProvinciaForal(provincia: string): boolean {
  const norm = provincia.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  return norm.split(/[^A-Z]+/).some((p) => FORALES.has(p))
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON externo sin esquema */
type Json = any

const aLista = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x])

const noSoportado = { ok: false, error: { tipo: 'noSoportado' } } as const

function rc(r: Json): string {
  return `${r.pc1}${r.pc2}${r.car ?? ''}${r.cc1 ?? ''}${r.cc2 ?? ''}`
}

function aInmueble(rcJson: Json, dt: Json, debi: Json): Inmueble {
  const lourb = dt?.locs?.lous?.lourb
  const dir = lourb?.dir
  const via = dir
    ? [dir.tv, dir.nv, `${dir.pnp ?? ''}${dir.plp ?? ''}`].filter(Boolean).join(' ')
    : ''
  return {
    rc: rc(rcJson),
    uso: debi?.luso ?? '',
    m2: Number(debi?.sfc ?? 0),
    anio: Number(debi?.ant ?? 0),
    planta: lourb?.loint?.pt ?? '',
    puerta: lourb?.loint?.pu ?? '',
    direccion: [via, dt?.nm].filter(Boolean).join(', '),
  }
}

function inmuebles(r: Json): Inmueble[] {
  const lista = aLista<Json>(r.lrcdnp?.rcdnp).map((i) => aInmueble(i.rc, i.dt, i.debi))
  const bicos = aLista<Json>(r.bico).map((b) => aInmueble(b.bi.idbi.rc, b.bi.dt, b.bi.debi))
  return [...lista, ...bicos]
}

function parcelas(r: Json): Parcela[] {
  return aLista<Json>(r.coordenadas_distancias?.coordd)
    .flatMap((c) => aLista<Json>(c.lpcd))
    .map((p) => ({ pc: rc(p.pc), direccion: p.ldt ?? '', distancia: Number(p.dis) }))
    .sort((a, b) => a.distancia - b.distancia)
}

async function consultar<T>(
  fetchFn: typeof fetch,
  url: string,
  extraer: (r: Json) => T[],
): Promise<Resultado<T[]>> {
  let texto: string
  try {
    const res = await fetchFn(url)
    if (!res.ok) return { ok: false, error: { tipo: 'red', mensaje: `HTTP ${res.status}` } }
    texto = await res.text()
  } catch (e) {
    return {
      ok: false,
      error: { tipo: 'red', mensaje: e instanceof Error ? e.message : String(e) },
    }
  }

  let r: Json
  try {
    r = Object.values(JSON.parse(texto))[0]
    if (typeof r !== 'object' || r === null) throw new Error()
  } catch {
    return { ok: false, error: { tipo: 'api', mensaje: 'Respuesta no válida' } }
  }

  const err = aLista<Json>(r.lerr)[0]
  if (err) {
    const codigo = String(err.cod)
    const mensaje = String(err.des ?? '')
    return SIN_RESULTADOS.has(codigo)
      ? { ok: false, error: { tipo: 'sinResultados', mensaje } }
      : { ok: false, error: { tipo: 'api', codigo, mensaje } }
  }

  try {
    const valor = extraer(r)
    if (valor.length === 0) {
      return { ok: false, error: { tipo: 'sinResultados', mensaje: 'Sin resultados' } }
    }
    return { ok: true, valor }
  } catch {
    return { ok: false, error: { tipo: 'api', mensaje: 'Formato inesperado' } }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function crearClienteCatastro(fetchFn: typeof fetch): ClienteCatastro {
  return {
    buscarPorDireccion(l: Localizacion): Promise<Resultado<Inmueble[]>> {
      if (esProvinciaForal(l.provincia)) return Promise.resolve(noSoportado)
      const q = new URLSearchParams({
        Provincia: l.provincia,
        Municipio: l.municipio,
        Sigla: l.sigla,
        Calle: l.calle,
        Numero: l.numero,
      })
      return consultar(fetchFn, `${CALLEJERO}Consulta_DNPLOC?${q}`, inmuebles)
    },

    buscarPorCoordenadas(
      c: { lat: number; lon: number },
      provincia?: string,
    ): Promise<Resultado<Parcela[]>> {
      if (provincia && esProvinciaForal(provincia)) return Promise.resolve(noSoportado)
      const q = new URLSearchParams({
        CoorX: String(c.lon),
        CoorY: String(c.lat),
        SRS: 'EPSG:4326',
      })
      return consultar(fetchFn, `${COORDENADAS}Consulta_RCCOOR_Distancia?${q}`, parcelas)
    },

    /** Parcela (14 car.) → todos sus inmuebles; RC (20 car.) → ese inmueble. */
    buscarPorReferencia(refCat: string): Promise<Resultado<Inmueble[]>> {
      const q = new URLSearchParams({ RefCat: refCat })
      return consultar(fetchFn, `${CALLEJERO}Consulta_DNPRC?${q}`, inmuebles)
    },
  }
}
