import type { Inmueble } from '../tipos'

export type ErrorCatastro =
  | { tipo: 'noSoportado' }
  | { tipo: 'sinResultados'; mensaje: string }
  | { tipo: 'api'; codigo?: string; mensaje: string }
  | { tipo: 'red'; mensaje: string }

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: ErrorCatastro }

export interface Parcela {
  /** Referencia de parcela (14 car.). */
  pc: string
  direccion: string
  /** Metros a las coordenadas consultadas. */
  distancia: number
}

export interface Localizacion {
  provincia: string
  municipio: string
  sigla: string
  calle: string
  numero: string
}

/** Número de una vía y su parcela (14 car.). */
export interface NumeroVia {
  numero: string
  pc: string
}

export interface ClienteCatastro {
  /** Números de la vía cercanos a `l.numero` (vacío → primeros). */
  buscarNumeros(l: Localizacion): Promise<Resultado<NumeroVia[]>>
  buscarPorDireccion(l: Localizacion): Promise<Resultado<Inmueble[]>>
  /** Parcelas a ≤ `radioM` (BBOX), ordenadas por distancia. */
  parcelasEnRadio(
    c: { lat: number; lon: number },
    radioM: number,
    provincia?: string,
  ): Promise<Resultado<Parcela[]>>
  /** Parcelas a ~25 m (distancia al polígono). */
  buscarPorCoordenadas(
    c: { lat: number; lon: number },
    provincia?: string,
  ): Promise<Resultado<Parcela[]>>
  /** Parcela (14 car.) → todos sus inmuebles; RC (20 car.) → ese inmueble. */
  buscarPorReferencia(refCat: string): Promise<Resultado<Inmueble[]>>
}

/** Elección del usuario: candidato elegido o RC pegada. */
export interface SeleccionManual {
  rc: string
}

/** Almacenamiento local por id de anuncio. */
export interface Almacen {
  leer(idAnuncio: string): Promise<SeleccionManual | undefined>
  guardar(idAnuncio: string, seleccion: SeleccionManual): Promise<void>
}
