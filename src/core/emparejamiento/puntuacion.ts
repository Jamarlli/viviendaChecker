import type { Anuncio, Candidato, Confianza, Inmueble } from '../tipos'
import {
  FACTOR_UTILES,
  MARGEN_ANIO,
  MARGEN_ANIO_PENALIZA,
  MAX_EMPATADOS_MEDIA,
  PESOS,
  TOLERANCIA_SUPERFICIE,
  UMBRAL_ALTA,
  UMBRAL_MEDIA,
  VALOR_ANEXO,
  VENTAJA_ALTA,
  VENTAJA_MEDIA,
} from './constantes'
import { cuadraConAnexo } from '../anexos'
import { normalizarPlanta } from '../planta'

// Evita que el redondeo binario rompa los bordes (p. ej. 1 - 0,8 < 0,2).
const EPSILON = 1e-9

type Senal = keyof typeof PESOS

/**
 * 1 directa, 0,5 sumando garaje o trastero de `parcela` (spec 02), 0 no; `undefined` si el
 * anuncio no da superficie.
 */
export function coincideSuperficie(
  anuncio: Anuncio,
  inmueble: Inmueble,
  parcela: Inmueble[] = [],
): number | undefined {
  const m2 = anuncio.m2Construidos ?? (anuncio.m2Utiles && anuncio.m2Utiles * FACTOR_UTILES)
  if (!m2) return undefined
  if (Math.abs(inmueble.m2 - m2) <= m2 * TOLERANCIA_SUPERFICIE + EPSILON) return 1
  return cuadraConAnexo(anuncio, m2, inmueble, parcela) ? VALOR_ANEXO : 0
}

/** `undefined` si el anuncio no da planta evaluable. Ático sin planta → 'atico'. */
function coincidePlanta(anuncio: Anuncio, inmueble: Inmueble): boolean | undefined {
  const p = normalizarPlanta(anuncio.planta) ?? (anuncio.tipo === 'atico' ? 'atico' : undefined)
  if (!p || p === 'otro') return undefined
  return p === normalizarPlanta(inmueble.planta)
}

/** 1 suma su peso, 0 no suma, -1 lo resta. */
function valorAnio(anuncio: number, catastro: number): number {
  if (!catastro) return 0
  const dif = Math.abs(catastro - anuncio)
  return dif <= MARGEN_ANIO ? 1 : dif > MARGEN_ANIO_PENALIZA ? -1 : 0
}

export function puntuar(anuncio: Anuncio, inmueble: Inmueble, parcela: Inmueble[] = []): number {
  const valor: Partial<Record<Senal, number>> = {}

  const superficie = coincideSuperficie(anuncio, inmueble, parcela)
  if (superficie !== undefined) valor.superficie = superficie

  const planta = coincidePlanta(anuncio, inmueble)
  if (planta !== undefined) valor.planta = Number(planta)

  if (anuncio.anio) valor.anio = valorAnio(anuncio.anio, inmueble.anio)

  // El anuncio siempre ofrece vivienda: el uso se evalúa siempre.
  valor.uso = Number(/residencial/i.test(inmueble.uso))

  let total = 0
  let obtenido = 0
  for (const [senal, v] of Object.entries(valor) as [Senal, number][]) {
    total += PESOS[senal]
    obtenido += v * PESOS[senal]
  }
  return Math.max(0, obtenido / total)
}

const mayor = (a: number, b: number) => (Math.abs(a - b) > EPSILON ? b - a : 0)

/**
 * Orden: misma planta que el anuncio (si la indica) → puntuación → distancia de la parcela
 * (sin distancia, al final) → orden de entrada.
 */
export function ordenarCandidatos(
  anuncio: Anuncio,
  inmuebles: Inmueble[],
  distancias: Map<Inmueble, number> = new Map(),
  parcela: Inmueble[] = inmuebles,
): Candidato[] {
  return inmuebles
    .map((inmueble) => {
      const c: Candidato = { inmueble, puntuacion: puntuar(anuncio, inmueble, parcela) }
      const distancia = distancias.get(inmueble)
      if (distancia !== undefined) c.distancia = distancia
      return { c, misma: Number(coincidePlanta(anuncio, inmueble) ?? false) }
    })
    .sort(
      (a, b) =>
        b.misma - a.misma ||
        mayor(a.c.puntuacion, b.c.puntuacion) ||
        porDistancia(a.c.distancia, b.c.distancia),
    )
    .map(({ c }) => c)
}

/** Sin distancia, al final; dos sin distancia, empate (evita Infinity − Infinity = NaN). */
function porDistancia(a?: number, b?: number): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
  return a - b
}

/** `candidatos` en el orden de `ordenarCandidatos`: el 1.º es el primero. */
export function calcularConfianza(
  candidatos: Candidato[],
  { coordsAproximadas = false } = {},
): Confianza {
  const [c1, c2] = candidatos
  if (!c1) return 'ninguna'
  const primero = c1.puntuacion
  const ventaja = primero - (c2?.puntuacion ?? 0)
  if (!coordsAproximadas && primero >= UMBRAL_ALTA - EPSILON && ventaja >= VENTAJA_ALTA - EPSILON)
    return 'alta'
  const distinto = candidatos.findIndex((c) => Math.abs(c.puntuacion - primero) > EPSILON)
  const empatados = distinto < 0 ? candidatos.length : distinto
  if (
    primero >= UMBRAL_MEDIA - EPSILON &&
    (ventaja >= VENTAJA_MEDIA - EPSILON || empatados <= MAX_EMPATADOS_MEDIA)
  )
    return 'media'
  return 'baja'
}
