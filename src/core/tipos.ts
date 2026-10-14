// 01 · Extracción
export type TipoInmueble = 'piso' | 'atico' | 'duplex' | 'estudio' | 'casa' | 'otro'

export interface Anuncio {
  portal: 'idealista'
  id: string
  url: string
  precio?: number
  tipo?: TipoInmueble
  obraNueva: boolean
  direccion?: { via?: string; numero?: string }
  municipio?: string
  provincia?: string
  coords?: { lat: number; lon: number; aproximada: boolean }
  /** Normalizada con `normalizarPlanta` (core/planta.ts). */
  planta?: string
  m2Construidos?: number
  m2Utiles?: number
  anio?: number
  descripcion: string
  mencionaTrastero: boolean
  mencionaGaraje: boolean
}

// 02 · Emparejamiento
export interface Inmueble {
  rc: string
  uso: string
  m2: number
  anio: number
  planta: string
  puerta: string
  direccion: string
}

export interface Candidato {
  inmueble: Inmueble
  /** 0-1 */
  puntuacion: number
}

export type Confianza = 'alta' | 'media' | 'baja' | 'ninguna'
/** 'ninguno': sin dirección completa ni coords, no se consultó. */
export type OrigenEmparejamiento = 'direccion' | 'coords' | 'manual' | 'ninguno'

export interface Emparejamiento {
  candidatos: Candidato[]
  confianza: Confianza
  origen: OrigenEmparejamiento
}

// 03 · Discrepancias
export type CampoDiscrepancia = 'superficie' | 'anio' | 'uso' | 'planta' | 'anexo'
export type NivelDiscrepancia = 'ok' | 'revisar' | 'aviso'

export interface Discrepancia {
  campo: CampoDiscrepancia
  nivel: NivelDiscrepancia
  anuncio?: string
  catastro?: string
  explicacion: string
  /** Emparejamiento de confianza baja o ninguna. */
  pocoFiable?: boolean
}

// 04 · Gastos de compra
export interface Rango {
  min: number
  max: number
}

export type ConceptoGasto = 'itp' | 'iva' | 'ajd' | 'notaria' | 'registro' | 'gestoria'

export interface PartidaGasto {
  concepto: ConceptoGasto
  importe: Rango
}

export interface Gastos {
  comunidad: string
  desglose: PartidaGasto[]
  total: Rango
}

// 05 · Alertas
export type TipoAlerta =
  | 'ocupado'
  | 'subasta'
  | 'nudaPropiedad'
  | 'alquilado'
  | 'proteccionOficial'
  | 'sinVisitas'
  | 'proindiviso'

export interface Alerta {
  tipo: TipoAlerta
  /** Frase de la descripción que activa la alerta. */
  frase: string
}
