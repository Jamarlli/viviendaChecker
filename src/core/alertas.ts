import type { Alerta, TipoAlerta } from './tipos'

interface Patron {
  re: RegExp
  /** Contexto inmediatamente posterior que anula la coincidencia. */
  salvo?: RegExp
}

const p = (re: RegExp, salvo?: RegExp): Patron => ({ re, salvo })

// Texto ya normalizado: minúsculas y sin tildes.
const PATRONES: Record<TipoAlerta, Patron[]> = {
  ocupado: [
    p(/\bocupad[oa]s?\b/, /^ por (sus?|el|la|los|las) (propietari|duen)/),
    p(/\bokupa(s|d[oa]s?)?\b/),
    // Sin k suele ser verbo ("el salón ocupa 30 m²"): solo plural o tras determinante.
    p(/\b(un|el|los|con|hay) ocupas?\b|\bocupas\b/),
    p(/\bocupantes\b/),
    p(/\bocupacion ilegal\b/),
    p(/\bsin posesion\b/),
    p(/\bno se (entrega|da) (la )?posesion\b/),
  ],
  subasta: [
    p(/\bsubast(a|as|ad[oa]s?)\b/),
    p(/\bcesion de remate\b/),
    p(/\badjudica(cion|d[oa])\b/, /^ (de|a) (la |las |los )?obras?\b/),
    p(/\bejecucion hipotecaria\b/),
    p(/\b(venta|cesion|compra) del? credito\b/),
  ],
  nudaPropiedad: [
    p(/\bnuda[ -]?propiedad\b/),
    p(/\busufructo(s)?\b/, /^.{0,25}\b(extingui|cancelad|consolidad)/),
    p(/\busufructuari[oa]s?\b/),
  ],
  alquilado: [
    p(/\balquilad[oa]s?\b/),
    p(/\barrendad[oa]s?\b/),
    p(/\binquilin[oa]s?\b/),
    p(/\barrendatari[oa]s?\b/),
    p(/\brentabilidad actual\b/),
    p(/\bcontrato de (alquiler|arrendamiento) (en vigor|vigente)\b/),
  ],
  proteccionOficial: [
    p(/\b(vpo|vpp|vppl|vpt|hpo)\b/, /^.{0,25}\bdescalificad/),
    p(/\bproteccion (oficial|publica)\b/, /^.{0,25}\bdescalificad/),
    p(/\bvivienda protegida\b/),
    p(/\bprecio (limitado|tasado)\b/),
  ],
  sinVisitas: [
    p(/\bno se puede (visitar|ensenar|ver por dentro)\b/),
    p(/\bno se (permiten|admiten|realizan|hacen|aceptan) visitas\b/),
    p(/\bsin visitas?\b/, /^ virtual/),
    p(/\bsin posibilidad de visita(r|s)?\b/),
    p(/\bno visitable\b/),
    p(/\b(solo|solamente|unicamente|exclusivo|exclusivamente) (para )?inversores\b/),
  ],
  proindiviso: [
    p(/\bpro[ -]?indiviso\b/),
    p(/\b(mitad|cuota|participacion|parte) indivisa\b/),
    p(/\bpendiente de herencia\b/),
    p(/\b(herencia en tramite|tramite de herencia|herencia yacente)\b/),
    p(/\bherencia (sin|no) (aceptad|adjudicad|repartid)/),
    p(/\bse vende (el|un|una) (?!100\b)\d+([,.]\d+)? ?%/),
  ],
}

const NEGACION = /\b(no|ni|sin|nunca|tampoco|libres? de|estuvo|estaba|ha estado)\b/g
const ARTICULOS = /^((de|del|el|la|los|las|un|una|unos|unas)\s*){0,2}$/
const FIN_ORACION =
  /(?<!\b(?:aprox|sra?|sres|dcha|izq|izda|etc|ctra|avda|pza|urb|pta|num|tlf)\.)(?<=[.!?])\s+|\n+/i

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const oraciones = (texto: string) =>
  texto
    .split(FIN_ORACION)
    .map((o) => o.trim())
    .filter(Boolean)

const palabras = (s: string) => s.split(/\s+/).filter(Boolean).length

/**
 * La última negación de la cláusula cubre la coincidencia si está a ≤3 palabras
 * o si esta es un elemento de su enumeración ("libre de cargas, ocupantes e inquilinos").
 */
const negada = (antes: string) => {
  const clausula = antes.split(/[:;()]|\b(?:pero|aunque)\b/).pop() ?? ''
  const neg = [...clausula.matchAll(NEGACION)].at(-1)
  if (!neg) return false
  const elementos = clausula.slice(neg.index + neg[0].length).split(/,|\b(?:y|e|ni|o)\b/)
  const ultimo = elementos.pop() ?? ''
  if (!elementos.length) return palabras(ultimo) <= 3
  return elementos.every((e) => palabras(e) <= 3) && ARTICULOS.test(ultimo.trim())
}

const activa = (norm: string, { re, salvo }: Patron) => {
  for (const m of norm.matchAll(new RegExp(re.source, 'g'))) {
    const fin = m.index + m[0].length
    if (salvo?.test(norm.slice(fin))) continue
    if (!negada(norm.slice(0, m.index))) return true
  }
  return false
}

export function detectarAlertas(descripcion: string): Alerta[] {
  const frases = oraciones(descripcion).map((o) => ({ o, norm: normalizar(o) }))
  const alertas: Alerta[] = []
  for (const [tipo, patrones] of Object.entries(PATRONES) as [TipoAlerta, Patron[]][]) {
    const f = frases.find(({ norm }) => patrones.some((pt) => activa(norm, pt)))
    if (f) alertas.push({ tipo, frase: f.o })
  }
  return alertas
}
