// Valores iniciales de la spec 02; se ajustarán con anuncios reales.
export const PESOS = { superficie: 0.45, planta: 0.3, anio: 0.15, uso: 0.1 } as const

export const TOLERANCIA_SUPERFICIE = 0.15
export const FACTOR_UTILES = 1.2
export const MARGEN_ANIO = 2

export const UMBRAL_ALTA = 0.8
export const VENTAJA_ALTA = 0.2
export const UMBRAL_MEDIA = 0.6

// Por coords: radio de búsqueda (p95 del desplazamiento medido en #26) y parcelas que se
// consultan con DNPRC, las más cercanas.
export const RADIO_M = 250
export const MAX_PARCELAS = 25
