import { describe, expect, it } from 'vitest'
import { normalizarPlanta } from './planta'

describe('normalizarPlanta', () => {
  it.each(['bajo', 'Bajo', 'BJ', 'bj', '00', '0', ' 00 '])('%s → bajo', (p) => {
    expect(normalizarPlanta(p)).toBe('bajo')
  })

  it.each([
    ['1', '1'],
    ['01', '1'],
    ['12', '12'],
    ['-1', '-1'],
    ['-01', '-1'],
  ])('%s → %s', (p, esperado) => {
    expect(normalizarPlanta(p)).toBe(esperado)
  })

  it('otros códigos se mantienen en minúsculas', () => {
    expect(normalizarPlanta('AT')).toBe('at')
    expect(normalizarPlanta('SS')).toBe('ss')
  })

  it('vacía → undefined', () => {
    expect(normalizarPlanta('')).toBeUndefined()
    expect(normalizarPlanta('  ')).toBeUndefined()
    expect(normalizarPlanta(undefined)).toBeUndefined()
  })
})
