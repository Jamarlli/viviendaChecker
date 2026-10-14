// Textos y formato del panel. Sin DOM.
import type { ErrorCatastro } from '../emparejamiento/puertos'
import { NOTA_GASTOS } from '../gastos'
import { normalizarPlanta } from '../planta'
import type {
  CampoDiscrepancia,
  ConceptoGasto,
  Confianza,
  Discrepancia,
  Gastos,
  Inmueble,
  NivelDiscrepancia,
  Rango,
  TipoAlerta,
} from '../tipos'
import type { Analisis } from './analisis'

export const MAX_CANDIDATOS = 10

const PLANTAS: Record<string, string> = {
  bajo: 'Bajo',
  entreplanta: 'Entreplanta',
  atico: 'Ático',
  sotano: 'Sótano',
}

export function textoPlanta(planta: string): string {
  const p = normalizarPlanta(planta)
  if (!p) return ''
  if (/^\d+$/.test(p)) return `Planta ${p}`
  return PLANTAS[p] ?? planta.trim()
}

export function etiquetaInmueble(i: Inmueble): string {
  return [
    textoPlanta(i.planta),
    i.puerta && `Puerta ${i.puerta}`,
    i.m2 && `${i.m2} m²`,
    i.uso,
    i.anio && String(i.anio),
  ]
    .filter(Boolean)
    .join(' · ')
}

const CONFIANZA: Record<Confianza, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
  ninguna: 'Sin coincidencias',
}

export function mensajeError(e: ErrorCatastro): string {
  switch (e.tipo) {
    case 'noSoportado':
      return 'El País Vasco y Navarra tienen catastro propio y aún no están soportados.'
    case 'red':
      return 'No se pudo conectar con el Catastro. Inténtalo más tarde.'
    case 'api':
      return `El Catastro devolvió un error: ${e.mensaje}`
    case 'sinResultados':
      return 'El Catastro no encontró nada.'
  }
}

export interface FilaCandidato {
  rc: string
  etiqueta: string
  coincidencia: string
}

export type VistaInmueble =
  | { estado: 'error'; mensaje: string }
  | { estado: 'sinCandidatos' }
  | {
      estado: 'confirmado' | 'sinConfirmar'
      rc: string
      direccion: string
      etiqueta: string
      confianza: string
      candidatos: FilaCandidato[]
    }

const porcentaje = (n: number) => `${Math.round(n * 100)} %`

export function vistaInmueble({ emparejamiento: e, error }: Analisis): VistaInmueble {
  if (error) return { estado: 'error', mensaje: mensajeError(error) }
  const primero = e?.candidatos[0]
  if (!e || !primero) return { estado: 'sinCandidatos' }
  const { inmueble } = primero
  const confirmado = e.origen === 'manual'
  return {
    estado: confirmado ? 'confirmado' : 'sinConfirmar',
    rc: inmueble.rc,
    direccion: inmueble.direccion,
    etiqueta: etiquetaInmueble(inmueble),
    confianza: CONFIANZA[e.confianza],
    candidatos: confirmado
      ? []
      : e.candidatos.slice(0, MAX_CANDIDATOS).map((c) => ({
          rc: c.inmueble.rc,
          etiqueta: etiquetaInmueble(c.inmueble),
          coincidencia: porcentaje(c.puntuacion),
        })),
  }
}

const ORDEN: Record<NivelDiscrepancia, number> = { aviso: 0, revisar: 1, ok: 2 }

export const ordenarDiscrepancias = (ds: Discrepancia[]) =>
  [...ds].sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])

export const NOMBRE_CAMPO: Record<CampoDiscrepancia, string> = {
  superficie: 'Superficie',
  anio: 'Año de construcción',
  uso: 'Uso',
  planta: 'Planta',
  anexo: 'Trastero o garaje',
}

export const NOMBRE_NIVEL: Record<NivelDiscrepancia, string> = {
  aviso: 'Aviso',
  revisar: 'A revisar',
  ok: 'Cuadra',
}

export const TITULO_ALERTA: Record<TipoAlerta, string> = {
  ocupado: 'Posible vivienda ocupada',
  subasta: 'Subasta o cesión de remate',
  nudaPropiedad: 'Nuda propiedad o usufructo',
  alquilado: 'Vivienda alquilada',
  proteccionOficial: 'Protección oficial',
  sinVisitas: 'Sin visitas',
  proindiviso: 'Proindiviso o herencia',
}

export const NOMBRE_CONCEPTO: Record<ConceptoGasto, string> = {
  itp: 'ITP',
  iva: 'IVA',
  igic: 'IGIC',
  ipsi: 'IPSI',
  ajd: 'AJD',
  notaria: 'Notaría',
  registro: 'Registro',
  gestoria: 'Gestoría',
}

const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  // es-ES no agrupa los números de 4 cifras por defecto.
  useGrouping: 'always',
})

export const euros = (n: number) => EUROS.format(n)

export const textoRango = ({ min, max }: Rango) =>
  min === max ? euros(min) : `${euros(min)} – ${euros(max)}`

export const notasGastos = (g: Gastos) => [NOTA_GASTOS, ...(g.nota ? [g.nota] : [])]

export function enlaces(rc: string): { texto: string; url: string }[] {
  const q = new URLSearchParams({ UrbRus: 'U', RefC: rc, RCCompleta: rc, pest: 'rc' })
  return [
    {
      texto: 'Ver en la Sede del Catastro',
      url: `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx?${q}`,
    },
    { texto: 'Pedir nota simple (Registradores)', url: 'https://sede.registradores.org/' },
  ]
}
