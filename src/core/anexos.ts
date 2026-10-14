import type { Anuncio, Inmueble } from './tipos'

/** Uso catastral de garajes y trasteros ("Almacen-Estacionamiento"). */
export const USO_ANEXO = /almac|estacion|aparca/i

// m² típicos de una plaza o trastero con su parte de zonas comunes, si la parcela no los da.
const RANGO_TIPICO: [number, number] = [20, 35]
// Más grande es un garaje comunitario, no una plaza.
const MAX_PLAZA = 50
const TOLERANCIA = 0.05
const EPSILON = 1e-9

/** Garaje incluido en el precio o trastero en "Características básicas"; las menciones no bastan. */
const incluyeAnexo = (a: Anuncio) => a.garaje === 'incluido' || a.trastero === true

/**
 * Spec 02: `m2Anuncio` ≈ vivienda + una plaza de la misma parcela (≤ 50 m²), o + 20–35 m² si no
 * hay ninguna; ±5 % sobre el anuncio. `minimo`: m² que el anexo debe cubrir como poco (spec 03).
 */
export function cuadraConAnexo(
  anuncio: Anuncio,
  m2Anuncio: number,
  inmueble: Inmueble,
  parcela: Inmueble[],
  minimo = 0,
): boolean {
  if (!incluyeAnexo(anuncio) || USO_ANEXO.test(inmueble.uso)) return false
  const pc = inmueble.rc.slice(0, 14)
  const plazas = parcela
    .filter(
      (p) =>
        p.rc !== inmueble.rc && p.rc.startsWith(pc) && USO_ANEXO.test(p.uso) && p.m2 <= MAX_PLAZA,
    )
    .map((p): [number, number] => [p.m2, p.m2])
  const desde = m2Anuncio * (1 - TOLERANCIA) - inmueble.m2
  const hasta = m2Anuncio * (1 + TOLERANCIA) - inmueble.m2
  return (plazas.length ? plazas : [RANGO_TIPICO]).some(
    ([lo, hi]) => Math.max(lo, minimo, desde) <= Math.min(hi, hasta) + EPSILON,
  )
}
