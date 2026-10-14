// Siglas de tipo de vía del Catastro. Se prueban en orden.
const TIPOS: [string, string][] = [
  ['CALLE|C/|CL\\.?', 'CL'],
  ['AVENIDA|AVDA\\.?|AV\\.?', 'AV'],
  ['PLAZA|PZA\\.?', 'PZ'],
  ['PASEO|Pº|PSO\\.?', 'PS'],
  ['CARRETERA|CTRA\\.?', 'CR'],
  ['CAMINO', 'CM'],
  ['RONDA', 'RD'],
  ['TRAVESIA', 'TR'],
  ['GLORIETA', 'GL'],
  ['CALLEJON', 'CJ'],
  ['PASAJE', 'PJ'],
  ['URBANIZACION|URB\\.?', 'UR'],
  ['RAMBLA', 'RB'],
]

const PATRONES = TIPOS.map(
  ([alt, sigla]) => [new RegExp(`^(?:${alt})(?:\\s+|(?<=[./])\\s*)`), sigla] as const,
)
const ARTICULO = /^(?:DE\s+(?:LA|LOS|LAS)|DEL|DE)\s+/

/** "Calle de Alcalá" → { sigla: 'CL', calle: 'ALCALA' }. Sin tipo reconocible, CL. */
export function separarVia(via: string): { sigla: string; calle: string } {
  const v = via
    .toUpperCase()
    .normalize('NFD')
    .replace(/(?<!N)\p{M}/gu, '') // tildes fuera, Ñ dentro
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
  for (const [patron, sigla] of PATRONES) {
    const m = v.match(patron)
    if (m) return { sigla, calle: v.slice(m[0].length).replace(ARTICULO, '') }
  }
  return { sigla: 'CL', calle: v }
}
