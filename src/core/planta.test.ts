import { describe, expect, it } from 'vitest'
import { normalizarPlanta } from './planta'

describe('normalizarPlanta', () => {
  it.each([
    // Catastro
    ['BJ', 'bajo'],
    ['00', 'bajo'],
    ['0', 'bajo'],
    ['EN', 'entreplanta'],
    ['AT', 'atico'],
    ['SS', 'sotano'],
    ['ST', 'sotano'],
    ['-1', 'sotano'],
    ['-02', 'sotano'],
    ['OD', 'otro'],
    ['01', '1'],
    ['12', '12'],
    // Anuncio
    ['bajo', 'bajo'],
    ['Bajo', 'bajo'],
    ['entreplanta', 'entreplanta'],
    ['ático', 'atico'],
    ['sótano', 'sotano'],
    ['semisótano', 'sotano'],
    ['1', '1'],
    [' 00 ', 'bajo'],
  ])('%s → %s', (p, esperado) => {
    expect(normalizarPlanta(p)).toBe(esperado)
  })

  it('código desconocido → otro', () => {
    expect(normalizarPlanta('XX')).toBe('otro')
  })

  it('vacía → undefined', () => {
    expect(normalizarPlanta('')).toBeUndefined()
    expect(normalizarPlanta('  ')).toBeUndefined()
    expect(normalizarPlanta(undefined)).toBeUndefined()
  })
})
