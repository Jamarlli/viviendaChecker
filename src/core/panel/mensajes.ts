import type { NumeroVia } from '../emparejamiento/puertos'
import type { Anuncio, Candidato } from '../tipos'
import type { EstadoPanel, RespuestaAccion, ResultadoConfirmar } from './controlador'

/** Content script y panel → background. La respuesta va en `RespuestaDe`. */
export type MensajeAlFondo =
  | { tipo: 'anuncio'; anuncio: Anuncio | null }
  | { tipo: 'pedirEstado'; tab: number }
  | { tipo: 'confirmar'; tab: number; rc: string }
  | { tipo: 'buscarNumeros'; tab: number; via: string; numero: string }
  | { tipo: 'inmueblesParcela'; tab: number; pc: string }

export interface RespuestaDe {
  anuncio: undefined
  pedirEstado: EstadoPanel
  confirmar: ResultadoConfirmar
  buscarNumeros: RespuestaAccion<NumeroVia[]>
  inmueblesParcela: RespuestaAccion<Candidato[]>
}

/** Background → panel. */
export interface MensajeAlPanel {
  tipo: 'estado'
  tab: number
  estado: EstadoPanel
}

/** Remitente según `runtime.MessageSender`. */
export interface Remitente {
  tab?: number
  url?: string
}

const MAX_TEXTO = 200

const objeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const texto = (x: unknown): x is string => typeof x === 'string' && x.length <= MAX_TEXTO
const tab = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0

function esAnuncio(x: unknown): x is Anuncio {
  return (
    objeto(x) &&
    x.portal === 'idealista' &&
    texto(x.id) &&
    texto(x.url) &&
    typeof x.descripcion === 'string' &&
    typeof x.obraNueva === 'boolean' &&
    typeof x.mencionaTrastero === 'boolean' &&
    typeof x.mencionaGaraje === 'boolean'
  )
}

/**
 * Solo el panel de la extensión puede pedir acciones; el content script solo envía
 * el anuncio de su propia pestaña. Devuelve null si el mensaje no es válido.
 */
export function validarMensaje(
  m: unknown,
  remitente: Remitente,
  urlPanel: string,
): MensajeAlFondo | null {
  if (!objeto(m)) return null
  const desdePanel = remitente.url?.split(/[?#]/)[0] === urlPanel
  if (m.tipo === 'anuncio') {
    if (desdePanel || !tab(remitente.tab)) return null
    return m.anuncio === null || esAnuncio(m.anuncio)
      ? { tipo: 'anuncio', anuncio: m.anuncio }
      : null
  }
  if (!desdePanel || !tab(m.tab)) return null
  switch (m.tipo) {
    case 'pedirEstado':
      return { tipo: 'pedirEstado', tab: m.tab }
    case 'confirmar':
      return texto(m.rc) ? { tipo: 'confirmar', tab: m.tab, rc: m.rc } : null
    case 'buscarNumeros':
      return texto(m.via) && texto(m.numero)
        ? { tipo: 'buscarNumeros', tab: m.tab, via: m.via, numero: m.numero }
        : null
    case 'inmueblesParcela':
      return texto(m.pc) ? { tipo: 'inmueblesParcela', tab: m.tab, pc: m.pc } : null
  }
  return null
}
