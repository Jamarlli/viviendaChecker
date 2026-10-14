import { describe, expect, it } from 'vitest'
import { separarVia } from './via'

describe('separarVia', () => {
  it.each([
    ['Calle de Alcalá', 'CL', 'ALCALA'],
    ['Calle Mayor', 'CL', 'MAYOR'],
    ['Avenida de América', 'AV', 'AMERICA'],
    ['Plaza del Callao', 'PZ', 'CALLAO'],
    ['Paseo de la Castellana', 'PS', 'CASTELLANA'],
    ['Carretera de Castilla', 'CR', 'CASTILLA'],
    ['Camino de los Vinateros', 'CM', 'VINATEROS'],
    ['Ronda de Atocha', 'RD', 'ATOCHA'],
    ['Travesía de las Vistillas', 'TR', 'VISTILLAS'],
    ['Glorieta de Bilbao', 'GL', 'BILBAO'],
    ['Callejón del Gato', 'CJ', 'GATO'],
    ['Pasaje Doré', 'PJ', 'DORE'],
    ['Urbanización Las Lomas', 'UR', 'LAS LOMAS'],
    ['Rambla de Catalunya', 'RB', 'CATALUNYA'],
  ])('%s → %s %s', (via, sigla, calle) => {
    expect(separarVia(via)).toEqual({ sigla, calle })
  })

  it.each([
    ['C/ Alcalá', 'CL', 'ALCALA'],
    ['Avda. de Europa', 'AV', 'EUROPA'],
    ['Av. Europa', 'AV', 'EUROPA'],
    ['Pza. Mayor', 'PZ', 'MAYOR'],
    ['Pº de Recoletos', 'PS', 'RECOLETOS'],
  ])('abreviatura %s → %s %s', (via, sigla, calle) => {
    expect(separarVia(via)).toEqual({ sigla, calle })
  })

  it('sin tipo de vía → CL', () => {
    expect(separarVia('Alcalá')).toEqual({ sigla: 'CL', calle: 'ALCALA' })
  })

  it('solo quita el artículo inicial', () => {
    expect(separarVia('Calle Principado de Asturias')).toEqual({
      sigla: 'CL',
      calle: 'PRINCIPADO DE ASTURIAS',
    })
  })

  it('conserva la Ñ y normaliza espacios', () => {
    expect(separarVia('  calle   de  la Peña ')).toEqual({ sigla: 'CL', calle: 'PEÑA' })
  })

  it('el tipo debe ser palabra completa', () => {
    expect(separarVia('Calleja Honda')).toEqual({ sigla: 'CL', calle: 'CALLEJA HONDA' })
    expect(separarVia('Plazuela Mayor')).toEqual({ sigla: 'CL', calle: 'PLAZUELA MAYOR' })
  })
})
