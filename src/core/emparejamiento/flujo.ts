import type { Anuncio, Emparejamiento, Inmueble, OrigenEmparejamiento } from '../tipos'
import type { Almacen, ClienteCatastro, ErrorCatastro, Resultado } from './puertos'
import { calcularConfianza, ordenarCandidatos } from './puntuacion'
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
  coords: { lat: number; lon: number },
): Promise<Resultado<Inmueble[]>> {
  const parcelas = await catastro.buscarPorCoordenadas(coords, anuncio.provincia)
  if (!parcelas.ok) return parcelas
  const rs = await Promise.all(parcelas.valor.map((p) => catastro.buscarPorReferencia(p.pc)))
  const inmuebles: Inmueble[] = []
  for (const r of rs) {
    if (r.ok) inmuebles.push(...r.valor)
    else if (r.error.tipo !== 'sinResultados') return r
  }
  return inmuebles.length
    ? { ok: true, valor: inmuebles }
    : fallo({ tipo: 'sinResultados', mensaje: 'Sin inmuebles' })
}

/** Spec 02: manual → dirección (DNPLOC) → coords (RCCOOR + DNPRC) → ninguna. Nunca lanza. */
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
  return ninguna('direccion')
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
