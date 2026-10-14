import type {
  ClienteCatastro,
  Localizacion,
  NumeroVia,
  Parcela,
  Resultado,
} from '../../core/emparejamiento/puertos'
import type { Inmueble } from '../../core/tipos'

export type {
  ErrorCatastro,
  Localizacion,
  NumeroVia,
  Parcela,
  Resultado,
} from '../../core/emparejamiento/puertos'

const BASE = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/'
const CALLEJERO = `${BASE}COVCCallejero.svc/json/`
const COORDENADAS = `${BASE}COVCCoordenadas.svc/json/`
const WFS_PARCELAS = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx'
const M_POR_GRADO = 111320
// En Madrid centro el WFS tarda ~10 s a 250 m; más allá, mejor degradar a RCCOOR.
export const TIEMPO_WFS_MS = 15_000

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

function numeros(r: Json): NumeroVia[] {
  const vistos = new Set<string>()
  return aLista<Json>(r.nump)
    .map((n) => ({ numero: `${n.num?.pnp ?? ''}${(n.num?.plp ?? '').trim()}`, pc: rc(n.pc) }))
    .filter((n) => {
      const clave = `${n.pc}|${n.numero}`
      if (vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
}

async function consultar<T>(
  fetchFn: typeof fetch,
  url: string,
  extraer: (r: Json) => T[],
  signal?: AbortSignal,
): Promise<Resultado<T[]>> {
  let texto: string
  try {
    const res = await fetchFn(url, { signal })
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

  // `ObtenerNumerero` envuelve la lista en `err`.
  const err = aLista<Json>(r.lerr?.err ?? r.lerr)[0]
  if (err && !SIN_RESULTADOS.has(String(err.cod))) {
    return {
      ok: false,
      error: { tipo: 'api', codigo: String(err.cod), mensaje: String(err.des ?? '') },
    }
  }

  // "No encontrado" puede traer resultados cercanos (números de `ObtenerNumerero`).
  let valor: T[]
  try {
    valor = extraer(r)
  } catch {
    return { ok: false, error: { tipo: 'api', mensaje: 'Formato inesperado' } }
  }
  if (valor.length === 0) {
    return {
      ok: false,
      error: { tipo: 'sinResultados', mensaje: err ? String(err.des ?? '') : 'Sin resultados' },
    }
  }
  return { ok: true, valor }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type Punto = { lat: number; lon: number }

// Equirectangular: error despreciable a 250 m.
function distanciaM(a: Punto, b: Punto): number {
  const x = (b.lon - a.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot(x, b.lat - a.lat) * M_POR_GRADO
}

const etiqueta = (bloque: string, nombre: string) =>
  new RegExp(`<${nombre}[^>]*>([^<]*)</${nombre}>`).exec(bloque)?.[1]?.trim()

/** Aborta con `signal` o al pasar `ms` (setTimeout, no AbortSignal.timeout: así se prueba con timers falsos). */
function conLimite(ms: number, signal?: AbortSignal) {
  const ctrl = new AbortController()
  const abortar = () => ctrl.abort(signal?.reason)
  if (signal?.aborted) abortar()
  signal?.addEventListener('abort', abortar, { once: true })
  const t = setTimeout(() => ctrl.abort(new Error('Tiempo agotado')), ms)
  return {
    signal: ctrl.signal,
    fin() {
      clearTimeout(t)
      signal?.removeEventListener('abort', abortar)
    },
  }
}

/** GML de `CadastralParcel`. Sin DOMParser: no existe en el service worker. */
function parcelasGml(gml: string, centro: Punto, radioM: number): Resultado<Parcela[]> {
  if (gml.includes('<ExceptionReport')) {
    const mensaje = /<!\[CDATA\[([^\]]*)\]\]>/.exec(gml)?.[1] ?? 'Error WFS'
    return /No records/i.test(mensaje)
      ? { ok: false, error: { tipo: 'sinResultados', mensaje } }
      : { ok: false, error: { tipo: 'api', mensaje } }
  }
  if (!gml.includes('FeatureCollection'))
    return { ok: false, error: { tipo: 'api', mensaje: 'Respuesta no válida' } }

  const valor = gml
    .split('</member>')
    .flatMap((bloque) => {
      const pc = etiqueta(bloque, 'cp:nationalCadastralReference')
      const pos = etiqueta(bloque, 'gml:pos')?.split(/\s+/).map(Number)
      if (!pc || pos?.length !== 2) return []
      const [lat = NaN, lon = NaN] = pos
      return [{ pc, direccion: '', distancia: Math.round(distanciaM(centro, { lat, lon })) }]
    })
    .filter((p) => p.distancia <= radioM)
    .sort((a, b) => a.distancia - b.distancia)
  return valor.length
    ? { ok: true, valor }
    : { ok: false, error: { tipo: 'sinResultados', mensaje: 'Sin parcelas' } }
}

export function crearClienteCatastro(fetchFn: typeof fetch): ClienteCatastro {
  return {
    buscarNumeros(l: Localizacion): Promise<Resultado<NumeroVia[]>> {
      if (esProvinciaForal(l.provincia)) return Promise.resolve(noSoportado)
      const q = new URLSearchParams({
        Provincia: l.provincia,
        Municipio: l.municipio,
        TipoVia: l.sigla,
        NomVia: l.calle,
        // Vacío da error 41; 0 no existe y devuelve los primeros.
        Numero: l.numero || '0',
      })
      return consultar(fetchFn, `${CALLEJERO}ObtenerNumerero?${q}`, numeros)
    },

    buscarPorDireccion(l: Localizacion, signal?: AbortSignal): Promise<Resultado<Inmueble[]>> {
      if (esProvinciaForal(l.provincia)) return Promise.resolve(noSoportado)
      const q = new URLSearchParams({
        Provincia: l.provincia,
        Municipio: l.municipio,
        Sigla: l.sigla,
        Calle: l.calle,
        Numero: l.numero,
      })
      return consultar(fetchFn, `${CALLEJERO}Consulta_DNPLOC?${q}`, inmuebles, signal)
    },

    buscarPorCoordenadas(
      c: { lat: number; lon: number },
      provincia?: string,
      signal?: AbortSignal,
    ): Promise<Resultado<Parcela[]>> {
      if (provincia && esProvinciaForal(provincia)) return Promise.resolve(noSoportado)
      const q = new URLSearchParams({
        CoorX: String(c.lon),
        CoorY: String(c.lat),
        SRS: 'EPSG:4326',
      })
      return consultar(fetchFn, `${COORDENADAS}Consulta_RCCOOR_Distancia?${q}`, parcelas, signal)
    },

    async parcelasEnRadio(
      c: Punto,
      radioM: number,
      provincia?: string,
      signal?: AbortSignal,
    ): Promise<Resultado<Parcela[]>> {
      if (provincia && esProvinciaForal(provincia)) return noSoportado
      const dLat = radioM / M_POR_GRADO
      const dLon = dLat / Math.cos((c.lat * Math.PI) / 180)
      const bbox = [c.lat - dLat, c.lon - dLon, c.lat + dLat, c.lon + dLon]
      const q = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: 'cp:CadastralParcel',
        srsName: 'EPSG::4326',
        bbox: bbox.map((x) => x.toFixed(6)).join(','),
      })
      const limite = conLimite(TIEMPO_WFS_MS, signal)
      try {
        const res = await fetchFn(`${WFS_PARCELAS}?${q}`, { signal: limite.signal })
        if (!res.ok) return { ok: false, error: { tipo: 'red', mensaje: `HTTP ${res.status}` } }
        return parcelasGml(await res.text(), c, radioM)
      } catch (e) {
        return {
          ok: false,
          error: { tipo: 'red', mensaje: e instanceof Error ? e.message : String(e) },
        }
      } finally {
        limite.fin()
      }
    },

    /** Parcela (14 car.) → todos sus inmuebles; RC (20 car.) → ese inmueble. */
    buscarPorReferencia(refCat: string, signal?: AbortSignal): Promise<Resultado<Inmueble[]>> {
      const q = new URLSearchParams({ RefCat: refCat })
      return consultar(fetchFn, `${CALLEJERO}Consulta_DNPRC?${q}`, inmuebles, signal)
    },
  }
}
