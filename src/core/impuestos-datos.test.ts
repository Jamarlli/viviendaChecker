import { describe, expect, it } from 'vitest'
import datos from '../../data/impuestos.json'

const { comunidades } = datos
const normaliza = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

describe('data/impuestos.json', () => {
  it('tiene 19 comunidades con nombre único', () => {
    expect(comunidades).toHaveLength(19)
    expect(new Set(comunidades.map((c) => c.nombre)).size).toBe(19)
  })

  it('cubre 52 provincias sin duplicados, contando variantes', () => {
    const provincias = comunidades.flatMap((c) => c.provincias)
    expect(provincias).toHaveLength(52)
    const nombres = provincias.flatMap((p) => [p.nombre, ...p.variantes]).map(normaliza)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it.each(comunidades)('$nombre: tipos, tramos, fuente y fecha válidos', (c) => {
    const tipos = [c.ajd, ...c.itp.tramos.map((t) => t.tipo)]
    for (const tipo of tipos) {
      expect(tipo).toBeGreaterThanOrEqual(0)
      expect(tipo).toBeLessThanOrEqual(0.15)
    }
    expect(['marginal', 'total']).toContain(c.itp.modo)
    expect(c.itp.tramos[0]?.desde).toBe(0)
    const desdes = c.itp.tramos.map((t) => t.desde)
    expect(desdes).toEqual([...desdes].sort((a, b) => a - b))
    expect(c.fuente).toMatch(/^https:\/\//)
    expect(c.fechaConsulta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof c.verificado).toBe('boolean')
  })

  it('gastos fijos con rango coherente y fuente', () => {
    const { notaria, registro, gestoria, fuente } = datos.gastos
    for (const r of [notaria, registro, gestoria]) {
      expect(r.min).toBeGreaterThan(0)
      expect(r.max).toBeGreaterThanOrEqual(r.min)
    }
    expect(fuente).toMatch(/^https:\/\//)
  })
})
