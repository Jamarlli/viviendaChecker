import type { NumeroVia, Resultado } from '../emparejamiento/puertos'
import type { Anuncio, Candidato } from '../tipos'
import type { EstadoPanel } from './controlador'

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
  confirmar: boolean
  buscarNumeros: Resultado<NumeroVia[]>
  inmueblesParcela: Resultado<Candidato[]>
}

/** Background → panel. */
export interface MensajeAlPanel {
  tipo: 'estado'
  tab: number
  estado: EstadoPanel
}
