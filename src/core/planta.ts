/** Forma canónica: 'bajo' | 'entreplanta' | 'atico' | 'sotano' | '1' | '2'… | 'otro'. */
const SINONIMOS: Record<string, string> = {
  BAJO: 'bajo',
  BJ: 'bajo',
  ENTREPLANTA: 'entreplanta',
  EN: 'entreplanta',
  ATICO: 'atico',
  AT: 'atico',
  SOTANO: 'sotano',
  SEMISOTANO: 'sotano',
  SS: 'sotano',
  ST: 'sotano',
  OD: 'otro',
}

/** Única normalización de planta del proyecto (anuncio y Catastro). */
export function normalizarPlanta(planta: string | undefined): string | undefined {
  const p = planta
    ?.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
  if (!p) return undefined
  if (/^-?\d+$/.test(p)) {
    const n = Number(p)
    if (n === 0) return 'bajo'
    return n < 0 ? 'sotano' : String(n)
  }
  return SINONIMOS[p] ?? 'otro'
}
