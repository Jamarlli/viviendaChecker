import { describe, expect, it } from 'vitest'
import { detectarAlertas } from './alertas'
import type { TipoAlerta } from './tipos'

const tipos = (texto: string) => detectarAlertas(texto).map((a) => a.tipo)

const positivos: [TipoAlerta, string][] = [
  ['ocupado', 'Vivienda ocupada. Se vende sin posibilidad de visita.'],
  ['ocupado', 'Piso con okupas en el barrio de San Blas.'],
  ['ocupado', 'Inmueble okupado, ideal inversores.'],
  ['ocupado', 'Se vende sin posesión, consulte condiciones.'],
  ['ocupado', 'Activo bancario con ocupantes sin título.'],
  ['ocupado', 'Actualmente la vivienda se encuentra ocupada ilegalmente.'],
  ['ocupado', 'No se entrega la posesión del inmueble.'],
  ['subasta', 'Vivienda procedente de subasta judicial.'],
  ['subasta', 'Se vende mediante cesión de remate, precio muy por debajo de mercado.'],
  ['subasta', 'Adjudicación en procedimiento de ejecución hipotecaria.'],
  ['subasta', 'Venta del crédito hipotecario sobre la vivienda.'],
  ['subasta', 'Inmueble subastado, pendiente de adjudicación.'],
  ['nudaPropiedad', 'Se vende la nuda propiedad de este magnífico piso.'],
  ['nudaPropiedad', 'Venta con usufructo vitalicio a favor de la actual propietaria, de 82 años.'],
  ['nudaPropiedad', 'La vendedora se reserva el usufructo.'],
  ['nudaPropiedad', 'Oportunidad: nuda-propiedad en el centro.'],
  ['alquilado', 'Se vende alquilado con contrato hasta 2027.'],
  ['alquilado', 'Piso con inquilino, ideal inversores.'],
  ['alquilado', 'Rentabilidad actual del 6,5 %.'],
  ['alquilado', 'Actualmente arrendado por 850 €/mes.'],
  ['alquilado', 'Contrato de alquiler en vigor, inquilinos solventes.'],
  ['alquilado', 'Se vende con inquilinos al corriente de pago.'],
  ['proteccionOficial', 'Vivienda VPO en régimen de compraventa.'],
  ['proteccionOficial', 'Piso de protección oficial, consultar requisitos.'],
  ['proteccionOficial', 'VPP con plaza de garaje.'],
  ['proteccionOficial', 'Vivienda de precio limitado (VPPL).'],
  ['proteccionOficial', 'Vivienda protegida, precio máximo según módulo.'],
  ['proteccionOficial', 'Calificada como vivienda de protección pública.'],
  ['sinVisitas', 'No se puede visitar el interior.'],
  ['sinVisitas', 'Venta sin visitas.'],
  ['sinVisitas', 'Solo inversores, pago al contado.'],
  ['sinVisitas', 'No se permiten visitas.'],
  ['sinVisitas', 'Sin posibilidad de visitar el inmueble.'],
  ['sinVisitas', 'Exclusivo para inversores.'],
  ['sinVisitas', 'Vivienda no visitable.'],
  ['proindiviso', 'Se vende el 50 % en proindiviso.'],
  ['proindiviso', 'Venta de una mitad indivisa del inmueble.'],
  ['proindiviso', 'Vivienda pendiente de herencia.'],
  ['proindiviso', 'Inmueble en régimen pro indiviso entre hermanos.'],
  ['proindiviso', 'Herencia en trámite, firma en unos meses.'],
  ['proindiviso', 'Se vende el 25% de la vivienda.'],
]

const negativos: string[] = [
  'La vivienda no está ocupada y se entrega libre.',
  'Libre de cargas y ocupantes.',
  'Sin okupas ni inquilinos.',
  'El salón ocupa toda la fachada y tiene mucha luz.',
  'Actualmente ocupada por sus propietarios, entrega en 3 meses.',
  'Venta directa, sin subasta.',
  'No es una subasta ni una cesión de remate.',
  'Adjudicación de las obras de rehabilitación de fachada aprobada en junta.',
  'Edificio rehabilitado tras la adjudicación de obra a una constructora.',
  'Pleno dominio, sin usufructo.',
  'Se vende el pleno dominio, el usufructo ya se ha extinguido.',
  'Libre de usufructos y cargas.',
  'Ideal para inversores: se puede alquilar fácilmente.',
  'Zona muy demandada para alquilar.',
  'Se entrega sin inquilinos.',
  'Estuvo alquilado hasta 2023, ahora vacío.',
  'Libre de inquilinos.',
  'Alta rentabilidad si se destina a alquiler.',
  'No es VPO.',
  'Vivienda libre, sin protección oficial.',
  'Antigua VPO ya descalificada.',
  'Visitas sin compromiso.',
  'Visítelo sin compromiso, llámenos.',
  'No solo inversores: también ideal para familias.',
  'Pisos pensados para inversores y familias.',
  'Sin herencias pendientes, escrituras en regla.',
  'Herencia ya aceptada y escriturada.',
  'Financiación hasta el 100 % del valor.',
  'Piso exterior de 3 dormitorios, reformado, con ascensor.',
]

describe('detectarAlertas', () => {
  it.each(positivos)('%s: %s', (tipo, texto) => {
    expect(tipos(texto)).toContain(tipo)
  })

  it.each(negativos)('sin alertas: %s', (texto) => {
    expect(tipos(texto)).toEqual([])
  })

  it('normaliza mayúsculas y tildes', () => {
    expect(tipos('PROTECCION OFICIAL')).toEqual(['proteccionOficial'])
    expect(tipos('Cesion De Remate')).toEqual(['subasta'])
  })

  it('cita la oración original', () => {
    const texto =
      'Precioso piso de 90 m² en el centro. Se vende la nuda propiedad, usufructuaria de 85 años. Llame ya.'
    expect(detectarAlertas(texto)).toEqual([
      { tipo: 'nudaPropiedad', frase: 'Se vende la nuda propiedad, usufructuaria de 85 años.' },
    ])
  })

  it('no corta la oración en decimales', () => {
    expect(detectarAlertas('Rentabilidad actual del 5.5 % anual.')[0]?.frase).toBe(
      'Rentabilidad actual del 5.5 % anual.',
    )
  })

  it('una alerta por tipo como máximo', () => {
    expect(tipos('Piso ocupado. Okupas desde 2022. Sin posesión.')).toEqual(['ocupado'])
  })

  it('una negación no anula una mención posterior', () => {
    expect(detectarAlertas('No está alquilado el garaje. El piso está alquilado.')).toEqual([
      { tipo: 'alquilado', frase: 'El piso está alquilado.' },
    ])
  })

  it('detecta varias alertas', () => {
    const texto = 'Vivienda ocupada procedente de subasta.\nNo se puede visitar. Solo inversores.'
    expect(tipos(texto).sort()).toEqual(['ocupado', 'sinVisitas', 'subasta'])
  })

  it('texto vacío', () => {
    expect(detectarAlertas('')).toEqual([])
  })
})
