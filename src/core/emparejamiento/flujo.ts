import type { Anuncio, Emparejamiento, Inmueble, OrigenEmparejamiento } from '../tipos'
import type { Almacen, ClienteCatastro, ErrorCatastro, Resultado } from './puertos'
import { MAX_PARCELAS, RADIO_M } from './constantes'
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
): Resultado<Emparejamiento> {
  if (!r.ok) return r.error.tipo === 'sinResultados' ? ninguna(origen) : fallo(r.error)
  const candidatos = ordenarCandidatos(anuncio, r.valor)
  // Lo eligió el usuario: no hay duda que medir.
  const confianza =
    origen === 'manual'
      ? 'alta'
      : calcularConfianza(candidatos, { coordsAproximadas: anuncio.coords?.aproximada })
  return { ok: true, valor: { candidatos, confianza, origen } }
}

async function porCoordenadas(
  anuncio: Anuncio,
  catastro: ClienteCatastro,
  { lat, lon }: { lat: number; lon: number },
): Promise<Resultado<Inmueble[]>> {
  let parcelas = await catastro.parcelasEnRadio({ lat, lon }, RADIO_M, anuncio.provincia)
  // Degradación: el WFS es lento y menos estable que el callejero.
  if (!parcelas.ok) parcelas = await catastro.buscarPorCoordenadas({ lat, lon }, anuncio.provincia)
  if (!parcelas.ok) return parcelas
  const cercanas = [...parcelas.valor]
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, MAX_PARCELAS)
  const rs = await Promise.all(cercanas.map((p) => catastro.buscarPorReferencia(p.pc)))
  // Una parcela que falla se descarta; solo es error si no queda ninguna.
  const inmuebles = rs.flatMap((r) => (r.ok ? r.valor : []))
  const conSuperficie = inmuebles.filter((i) => coincideSuperficie(anuncio, i) !== false)
  if (conSuperficie.length) return { ok: true, valor: conSuperficie }
  if (inmuebles.length) return { ok: true, valor: inmuebles }
  const error = rs.find((r) => !r.ok && r.error.tipo !== 'sinResultados')
  return error ?? fallo({ tipo: 'sinResultados', mensaje: 'Sin inmuebles' })
}

/** Spec 02: manual → dirección (DNPLOC) → coords (WFS o RCCOOR + DNPRC) → ninguna. Nunca lanza. */
export async function emparejar(
  anuncio: Anuncio,
  { catastro, almacen }: DepsEmparejamiento,
): Promise<Resultado<Emparejamiento>> {
  const manual = await almacen.leer(anuncio.id)
  if (manual)
    return aEmparejamiento(anuncio, await catastro.buscarPorReferencia(manual.rc), 'manual')

  const { via, numero } = anuncio.direccion ?? {}
  const { provincia, municipio, coords } = anuncio
  if (via && numero && provincia && municipio) {
    const r = await catastro.buscarPorDireccion({
      provincia,
      municipio,
      numero,
      ...separarVia(via),
    })
    if (r.ok || r.error.tipo !== 'sinResultados' || !coords)
      return aEmparejamiento(anuncio, r, 'direccion')
  }

  if (coords)
    return aEmparejamiento(anuncio, await porCoordenadas(anuncio, catastro, coords), 'coords')
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
