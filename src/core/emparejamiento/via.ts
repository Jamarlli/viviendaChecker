// Siglas del Catastro; incluye catalán, valenciano y gallego. Se prueban en orden.
// Sin tildes ni cedilla: PLAÇA llega como PLACA.
const TIPOS: [string, string][] = [
  ['CALLE|CARRER|C/|CL\\.?', 'CL'],
  ['AVENIDA|AVINGUDA|AVDA\\.?|AV\\.?', 'AV'],
  ['PLAZA|PLACA|PRAZA|PZA\\.?', 'PZ'],
  ['PASEO|PASSEIG|Pº|PSO\\.?', 'PS'],
  ['CARRETERA|CTRA\\.?', 'CR'],
  ['CAMINO|CAMIÑO|CAMI', 'CM'],
  ['RONDA', 'RD'],
  ['TRAVESIA|TRAVESSERA|TRAVESSIA', 'TR'],
  ['GLORIETA', 'GL'],
  ['CALLEJON', 'CJ'],
  ['PASAJE', 'PJ'],
  ['URBANIZACION|URB\\.?', 'UR'],
  ['RAMBLA', 'RB'],
  ['RUA', 'RU'],
]

const PATRONES = TIPOS.map(
  ([alt, sigla]) => [new RegExp(`^(?:${alt})(?:\\s+|(?<=[./])\\s*)`), sigla] as const,
)
const ARTICULO =
  /^(?:DE\s+(?:LA|LOS|LAS|LES)\s+|DE\s+L['’]\s*|D['’]\s*|(?:DELS|DEL|DE|DOS|DAS|DO|DA)\s+)/

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
