// Ajustados con la medición de #26/#30 (docs/medicion-emparejamiento.md).
export const PESOS = { superficie: 0.45, planta: 0.35, anio: 0.1, uso: 0.1 } as const

export const TOLERANCIA_SUPERFICIE = 0.15
export const FACTOR_UTILES = 1.2
// Superficie que solo cuadra sumando garaje o trastero: la directa debe ganar.
export const VALOR_ANEXO = 0.5
// El año del Catastro es ruidoso: ±5 suma; más de 10 resta su peso.
export const MARGEN_ANIO = 5
export const MARGEN_ANIO_PENALIZA = 10

export const UMBRAL_ALTA = 0.8
export const VENTAJA_ALTA = 0.2
export const UMBRAL_MEDIA = 0.6
// 'media' exige destacar o pocos empatados en cabeza.
export const VENTAJA_MEDIA = 0.1
export const MAX_EMPATADOS_MEDIA = 3

// Por coords: radio de búsqueda (p95 del desplazamiento medido en #26) y parcelas que se
// consultan con DNPRC, las más cercanas.
export const RADIO_M = 250
export const MAX_PARCELAS = 25
// DNPRC simultáneas: no saturar la OVC.
export const CONCURRENCIA_DNPRC = 5
