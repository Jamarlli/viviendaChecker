import { describe, expect, it } from 'vitest'
import { cuadraConAnexo } from './anexos'
import type { Anuncio, Inmueble } from './tipos'

const anuncio = (a: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '1',
  url: 'https://www.idealista.com/inmueble/1/',
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  ...a,
})

const PC = '1111111AA1111A'
const vivienda = (m2: number): Inmueble => ({
  rc: `${PC}0001AA`,
  uso: 'Residencial',
  m2,
  anio: 2000,
  planta: '01',
  puerta: 'A',
  direccion: '',
})
const plaza = (m2: number, pc = PC, car = '0002'): Inmueble => ({
  ...vivienda(m2),
  rc: `${pc}${car}BB`,
  uso: 'Almacen-Estacionamiento',
  planta: '-1',
})

const incluido = anuncio({ mencionaGaraje: true, garaje: 'incluido' })
// Anuncio de 200 m², ±5 % → 190–210.
const cuadra = (v: number, parcela: Inmueble[] = [], a = incluido, minimo?: number) =>
  cuadraConAnexo(a, 200, vivienda(v), parcela, minimo)

describe('cuadraConAnexo', () => {
  it.each([
    [155, true],
    [154, false],
    [190, true],
    [191, false],
  ])('sin anexos conocidos: vivienda %i + 20–35 m² ≈ 200 → %s', (v, r) => {
    expect(cuadra(v)).toBe(r)
  })

  it.each([
    [160, true],
    [159, false],
    [180, true],
    [181, false],
  ])('con plaza de 30 m² en la parcela: vivienda %i → %s', (v, r) => {
    expect(cuadra(v, [plaza(30)])).toBe(r)
  })

  it('anexos de más de 50 m² (garaje comunitario) no son plaza: rango 20–35', () => {
    expect(cuadra(155, [plaza(924)])).toBe(true)
    expect(cuadra(155, [plaza(51)])).toBe(true)
    expect(cuadra(155, [plaza(30), plaza(924, PC, '0003')])).toBe(false)
  })

  it('plaza de otra parcela no cuenta: rango 20–35', () => {
    expect(cuadra(155, [plaza(30, '2222222AA2222A')])).toBe(true)
  })

  it('solo con garaje incluido o trastero en características básicas', () => {
    expect(cuadra(160, [], anuncio({ trastero: true }))).toBe(true)
    expect(cuadra(160, [], anuncio({ mencionaGaraje: true, mencionaTrastero: true }))).toBe(false)
    expect(cuadra(160, [], anuncio({ mencionaGaraje: true, garaje: 'opcional' }))).toBe(false)
  })

  it('al propio anexo no se le suma nada', () => {
    expect(cuadraConAnexo(incluido, 200, plaza(170), [])).toBe(false)
  })

  it('mínimo: el anexo debe cubrir al menos esos m²', () => {
    expect(cuadra(160, [plaza(30)], incluido, 30)).toBe(true)
    expect(cuadra(160, [plaza(30)], incluido, 31)).toBe(false)
    // Rango: 20–35 cubre hasta 35.
    expect(cuadra(170, [], incluido, 35)).toBe(true)
    expect(cuadra(170, [], incluido, 36)).toBe(false)
  })
})
