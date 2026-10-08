const BAJO = new Set(['BAJO', 'BJ'])

/** Unifica plantas del anuncio y del Catastro: 'bajo' | '1' | '-1' | otros en minúsculas. */
export function normalizarPlanta(planta: string | undefined): string | undefined {
  const p = planta?.trim().toUpperCase()
  if (!p) return undefined
  if (BAJO.has(p)) return 'bajo'
  if (/^-?\d+$/.test(p)) {
    const n = Number(p)
    return n === 0 ? 'bajo' : String(n)
  }
  return p.toLowerCase()
}
