import type { Anuncio, Candidato, Confianza, Inmueble } from '../tipos'
import {
  FACTOR_UTILES,
  MARGEN_ANIO,
  PESOS,
  TOLERANCIA_SUPERFICIE,
  UMBRAL_ALTA,
  UMBRAL_MEDIA,
  VENTAJA_ALTA,
} from './constantes'
import { normalizarPlanta } from '../planta'

// Evita que el redondeo binario rompa los bordes (p. ej. 1 - 0,8 < 0,2).
const EPSILON = 1e-9

type Senal = keyof typeof PESOS

export function puntuar(anuncio: Anuncio, inmueble: Inmueble): number {
  const coincide: Partial<Record<Senal, boolean>> = {}

  const m2 = anuncio.m2Construidos ?? (anuncio.m2Utiles && anuncio.m2Utiles * FACTOR_UTILES)
  if (m2) coincide.superficie = Math.abs(inmueble.m2 - m2) <= m2 * TOLERANCIA_SUPERFICIE + EPSILON

  const planta = normalizarPlanta(anuncio.planta)
  if (planta && planta !== 'otro') coincide.planta = planta === normalizarPlanta(inmueble.planta)

  if (anuncio.anio) coincide.anio = Math.abs(inmueble.anio - anuncio.anio) <= MARGEN_ANIO

  // El anuncio siempre ofrece vivienda: el uso se evalúa siempre.
  coincide.uso = /residencial/i.test(inmueble.uso)

  let total = 0
  let obtenido = 0
  for (const [senal, ok] of Object.entries(coincide) as [Senal, boolean][]) {
    total += PESOS[senal]
    if (ok) obtenido += PESOS[senal]
  }
  return obtenido / total
}

export function ordenarCandidatos(anuncio: Anuncio, inmuebles: Inmueble[]): Candidato[] {
  return inmuebles
    .map((inmueble) => ({ inmueble, puntuacion: puntuar(anuncio, inmueble) }))
    .sort((a, b) => b.puntuacion - a.puntuacion)
}

export function calcularConfianza(
  candidatos: Candidato[],
  { coordsAproximadas = false } = {},
): Confianza {
  if (!candidatos.length) return 'ninguna'
  const [primero = 0, segundo = 0] = candidatos.map((c) => c.puntuacion).sort((a, b) => b - a)
  if (
    !coordsAproximadas &&
    primero >= UMBRAL_ALTA - EPSILON &&
    primero - segundo >= VENTAJA_ALTA - EPSILON
  )
    return 'alta'
  if (primero >= UMBRAL_MEDIA - EPSILON) return 'media'
  return 'baja'
}
