import type { Anuncio, Gastos, PartidaGasto, Rango } from './tipos'

export const NOTA_GASTOS =
  'Tipo general. Puede haber tipos reducidos (jóvenes, familia numerosa…) y la base puede ser el valor de referencia si es mayor que el precio.'

interface Tramo {
  desde: number
  tipo: number
}

export interface ComunidadImpuestos {
  nombre: string
  provincias: { nombre: string; variantes: string[] }[]
  itp: { modo: 'marginal' | 'total'; tramos: Tramo[] }
  ajd: number
  /** Canarias (IGIC) y Ceuta y Melilla (IPSI): sustituye al IVA. */
  obraNueva?: { impuesto: 'igic' | 'ipsi'; tipo: number; nota: string }
}

export interface TablaImpuestos {
  comunidades: ComunidadImpuestos[]
  gastos: { notaria: Rango; registro: Rango; gestoria: Rango }
}

const IVA = { impuesto: 'iva', tipo: 0.1 } as const

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const comunidadDe = (provincia: string, tabla: TablaImpuestos) => {
  const p = normalizar(provincia)
  return tabla.comunidades.find((c) =>
    c.provincias.some((x) => [x.nombre, ...x.variantes].some((n) => normalizar(n) === p)),
  )
}

const centimos = (n: number) => Math.round(n * 100) / 100

// Un tramo aplica al valor que excede de `desde`.
const itp = (precio: number, { modo, tramos }: ComunidadImpuestos['itp']) => {
  if (modo === 'total') {
    const tramo = tramos.findLast((t, i) => i === 0 || precio > t.desde)
    return precio * (tramo?.tipo ?? 0)
  }
  return tramos.reduce((suma, t, i) => {
    const hasta = Math.min(precio, tramos[i + 1]?.desde ?? Infinity)
    return hasta > t.desde ? suma + (hasta - t.desde) * t.tipo : suma
  }, 0)
}

const fijo = (n: number): Rango => ({ min: centimos(n), max: centimos(n) })

export function calcularGastos(anuncio: Anuncio, tabla: TablaImpuestos): Gastos | null {
  const { precio, provincia, obraNueva } = anuncio
  if (!precio || !provincia) return null
  const c = comunidadDe(provincia, tabla)
  if (!c) return null

  const indirecto = c.obraNueva ?? IVA
  const impuestos: PartidaGasto[] = obraNueva
    ? [
        { concepto: indirecto.impuesto, importe: fijo(precio * indirecto.tipo) },
        { concepto: 'ajd', importe: fijo(precio * c.ajd) },
      ]
    : [{ concepto: 'itp', importe: fijo(itp(precio, c.itp)) }]

  const { notaria, registro, gestoria } = tabla.gastos
  const desglose: PartidaGasto[] = [
    ...impuestos,
    { concepto: 'notaria', importe: notaria },
    { concepto: 'registro', importe: registro },
    { concepto: 'gestoria', importe: gestoria },
  ]
  const total = desglose.reduce(
    (t, { importe }) => ({
      min: centimos(t.min + importe.min),
      max: centimos(t.max + importe.max),
    }),
    { min: 0, max: 0 },
  )
  const gastos: Gastos = { comunidad: c.nombre, desglose, total }
  if (obraNueva && c.obraNueva) gastos.nota = c.obraNueva.nota
  return gastos
}
