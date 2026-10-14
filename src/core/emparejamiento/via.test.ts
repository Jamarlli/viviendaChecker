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

  it.each([
    ['Carrer de Mallorca', 'CL', 'MALLORCA'],
    ["Carrer d'Aragó", 'CL', 'ARAGO'],
    ["Carrer de l'Escorial", 'CL', 'ESCORIAL'],
    ['Carrer dels Arcs', 'CL', 'ARCS'],
    ['Carrer de les Moreres', 'CL', 'MORERES'],
    ['Avinguda Diagonal', 'AV', 'DIAGONAL'],
    ['Plaça de Catalunya', 'PZ', 'CATALUNYA'],
    ['Praza do Obradoiro', 'PZ', 'OBRADOIRO'],
    ['Passeig de Gràcia', 'PS', 'GRACIA'],
    ['Ronda de Sant Pere', 'RD', 'SANT PERE'],
    ['Travessera de Gràcia', 'TR', 'GRACIA'],
    ['Travessia del Mar', 'TR', 'MAR'],
    ['Camí de la Font', 'CM', 'FONT'],
    ['Camiño dos Muíños', 'CM', 'MUIÑOS'],
    ['Rúa do Vilar', 'RU', 'VILAR'],
    ['Rúa da Raíña', 'RU', 'RAIÑA'],
    ['Rúa das Hortas', 'RU', 'HORTAS'],
  ])('catalán/valenciano/gallego %s → %s %s', (via, sigla, calle) => {
    expect(separarVia(via)).toEqual({ sigla, calle })
  })

  it('apóstrofo tipográfico', () => {
    expect(separarVia('Carrer d’Aragó')).toEqual({ sigla: 'CL', calle: 'ARAGO' })
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
