import type { Anuncio, Emparejamiento, Inmueble, OrigenEmparejamiento } from '../tipos'
import type { Almacen, ClienteCatastro, ErrorCatastro, Parcela, Resultado } from './puertos'
import { CONCURRENCIA_DNPRC, MAX_PARCELAS, RADIO_M } from './constantes'
import { calcularConfianza, coincideSuperficie, ordenarCandidatos } from './puntuacion'
import { separarVia } from './via'

export interface DepsEmparejamiento {
  catastro: ClienteCatastro
  almacen: Almacen
}

const RC = /^[0-9A-Z]{20}$/

const ninguna = (origen: OrigenEmparejamiento): Resultado<Emparejamiento> => ({
  ok: true,
  valor: { candidatos: [], confianza: 'ninguna', origen },
})

const fallo = (error: ErrorCatastro): Resultado<never> => ({ ok: false, error })

function aEmparejamiento(
  anuncio: Anuncio,
  r: Resultado<Inmueble[]>,
  origen: OrigenEmparejamiento,
  distancias?: Map<Inmueble, number>,
): Resultado<Emparejamiento> {
  if (!r.ok) return r.error.tipo === 'sinResultados' ? ninguna(origen) : fallo(r.error)
  const candidatos = ordenarCandidatos(anuncio, r.valor, distancias)
  // Lo eligió el usuario: no hay duda que medir.
  const confianza =
    origen === 'manual'
      ? 'alta'
      : calcularConfianza(candidatos, { coordsAproximadas: anuncio.coords?.aproximada })
  return { ok: true, valor: { candidatos, confianza, origen } }
}

/** `f` sobre `xs` con como mucho `n` a la vez, en orden; abortada, no empieza más. */
async function enPool<T, R>(
  xs: T[],
  n: number,
  f: (x: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const rs: R[] = []
  let i = 0
  const trabajador = async () => {
    while (i < xs.length && !signal?.aborted) {
      const j = i++
      rs[j] = await f(xs[j] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, trabajador))
  return rs.filter((r) => r !== undefined)
}

async function inmueblesDe(
  anuncio: Anuncio,
  catastro: ClienteCatastro,
  parcelas: Parcela[],
  distancias: Map<Inmueble, number>,
  signal?: AbortSignal,
): Promise<Resultado<Inmueble[]>> {
  const cercanas = [...parcelas].sort((a, b) => a.distancia - b.distancia).slice(0, MAX_PARCELAS)
  const rs = await enPool(
    cercanas,
    CONCURRENCIA_DNPRC,
    async (p) => {
      const r = await catastro.buscarPorReferencia(p.pc, signal)
      if (r.ok) for (const i of r.valor) distancias.set(i, p.distancia)
      return r
    },
    signal,
  )
  // Una parcela que falla se descarta; solo es error si no queda ninguna.
  const inmuebles = rs.flatMap((r) => (r.ok ? r.valor : []))
  const conSuperficie = inmuebles.filter((i) => coincideSuperficie(anuncio, i) !== false)
  if (conSuperficie.length) return { ok: true, valor: conSuperficie }
  if (inmuebles.length) return { ok: true, valor: inmuebles }
  const error = rs.find((r) => !r.ok && r.error.tipo !== 'sinResultados')
  return error ?? fallo({ tipo: 'sinResultados', mensaje: 'Sin inmuebles' })
}

const CANCELADO = fallo({ tipo: 'red', mensaje: 'Cancelado' })

async function porCoordenadas(
  anuncio: Anuncio,
  catastro: ClienteCatastro,
  { lat, lon }: { lat: number; lon: number },
  distancias: Map<Inmueble, number>,
  signal?: AbortSignal,
): Promise<Resultado<Inmueble[]>> {
  const radio = await catastro.parcelasEnRadio({ lat, lon }, RADIO_M, anuncio.provincia, signal)
  let previo: Resultado<Inmueble[]> | undefined
  if (radio.ok) {
    previo = await inmueblesDe(anuncio, catastro, radio.valor, distancias, signal)
    if (previo.ok || previo.error.tipo === 'sinResultados') return previo
  }
  if (signal?.aborted) return CANCELADO
  // Degradación: el WFS es lento y menos estable que el callejero.
  const cerca = await catastro.buscarPorCoordenadas({ lat, lon }, anuncio.provincia, signal)
  const r = cerca.ok ? await inmueblesDe(anuncio, catastro, cerca.valor, distancias, signal) : cerca
  return !r.ok && r.error.tipo === 'sinResultados' && previo ? previo : r
}

/** Spec 02: manual → dirección (DNPLOC) → coords (WFS o RCCOOR + DNPRC) → ninguna. Nunca lanza. */
export async function emparejar(
  anuncio: Anuncio,
  { catastro, almacen }: DepsEmparejamiento,
  signal?: AbortSignal,
): Promise<Resultado<Emparejamiento>> {
  const manual = await almacen.leer(anuncio.id)
  if (manual)
    return aEmparejamiento(anuncio, await catastro.buscarPorReferencia(manual.rc, signal), 'manual')

  const { via, numero } = anuncio.direccion ?? {}
  const { provincia, municipio, coords } = anuncio
  if (via && numero && provincia && municipio) {
    const r = await catastro.buscarPorDireccion(
      { provincia, municipio, numero, ...separarVia(via) },
      signal,
    )
    if (r.ok || r.error.tipo !== 'sinResultados' || !coords || signal?.aborted)
      return aEmparejamiento(anuncio, r, 'direccion')
  }

  if (coords) {
    const distancias = new Map<Inmueble, number>()
    const r = await porCoordenadas(anuncio, catastro, coords, distancias, signal)
    return aEmparejamiento(anuncio, r, 'coords', distancias)
  }
  return ninguna('ninguno')
}

/** Guarda el candidato elegido o la RC pegada. Devuelve false si la RC no es válida. */
export async function guardarSeleccion(
  almacen: Almacen,
  idAnuncio: string,
  rc: string,
): Promise<boolean> {
  const norm = rc.replace(/\s/g, '').toUpperCase()
  if (!RC.test(norm)) return false
  await almacen.guardar(idAnuncio, { rc: norm })
  return true
}
