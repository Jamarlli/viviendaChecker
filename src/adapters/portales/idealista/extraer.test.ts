import { readdirSync, readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import {
  extraerAnuncio,
  idDeUrl,
  parsearDireccion,
  parsearPlanta,
  parsearSuperficies,
  parsearTipo,
} from './extraer'

const DIR = 'fixtures/idealista'
const doc = (html: string) => parseHTML(html).document as unknown as Document
const url = (id: string) => `https://www.idealista.com/inmueble/${id}/`

describe('fixtures reales', () => {
  const ids = readdirSync(DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace('.html', ''))

  it('hay 24', () => expect(ids).toHaveLength(24))

  it.each(ids)('%s', (id) => {
    const esperado = JSON.parse(readFileSync(`${DIR}/esperado/${id}.json`, 'utf8'))
    const html = readFileSync(`${DIR}/${id}.html`, 'utf8')
    expect(extraerAnuncio(doc(html), url(id))).toEqual(esperado)
  })
})

describe('idDeUrl', () => {
  it.each([
    ['https://www.idealista.com/inmueble/104570830/', '104570830'],
    ['https://www.idealista.com/inmueble/104570830/?xtmc=1#foto', '104570830'],
    ['https://www.idealista.com/inmueble/104570830', '104570830'],
  ])('%s → %s', (u, id) => expect(idDeUrl(u)).toBe(id))

  it.each([
    'https://www.idealista.com/en/inmueble/104570830/',
    'https://www.idealista.com/ca/inmueble/104570830/',
    'https://www.idealista.com/venta-viviendas/madrid/',
    'https://www.idealista.com/inmueble/abc/',
    'https://www.fotocasa.es/inmueble/104570830/',
    'no es url',
  ])('%s → undefined', (u) => expect(idDeUrl(u)).toBeUndefined())
})

describe('extraerAnuncio', () => {
  it('URL que no es de inmueble → null', () => {
    expect(extraerAnuncio(doc('<html></html>'), 'https://www.idealista.com/')).toBeNull()
  })

  it('página vacía: campos ausentes undefined, sin fallar', () => {
    expect(extraerAnuncio(doc('<html><body></body></html>'), url('1'))).toEqual({
      portal: 'idealista',
      id: '1',
      url: url('1'),
      obraNueva: false,
      descripcion: '',
      mencionaTrastero: false,
      mencionaGaraje: false,
    })
  })

  it('precio de respaldo en config.idForm.buyingPrice', () => {
    const d = doc(`<script>var config = { idForm: { buyingPrice: 250000.0 } };</script>`)
    expect(extraerAnuncio(d, url('1'))?.precio).toBe(250000)
  })

  describe('aproximada sin addressVisibility', () => {
    const coords = (script: string, html = '') =>
      extraerAnuncio(doc(`<script>${script}</script>${html}`), url('1'))?.coords
    const aviso = '<div class="no-show-address-feedback"></div>'
    const mapa = 'var config = {"src":"x?center=40.1%2C-3.2&z=1"};'

    it('solo el aviso decide (sin markerVisible)', () => {
      expect(coords(mapa, aviso)).toEqual({ lat: 40.1, lon: -3.2, aproximada: true })
      expect(coords(mapa)?.aproximada).toBe(false)
    })

    it('markerVisible ≠ 1 → aproximada; = 1 → exacta', () => {
      expect(coords(mapa + 'var mapConfig = { markerVisible: 2 };')?.aproximada).toBe(true)
      expect(coords(mapa + 'var mapConfig = { markerVisible: 1 };')?.aproximada).toBe(false)
    })
  })

  it('center con coma literal', () => {
    expect(extraerAnuncio(doc('<script>x?center=40.1,-3.2&z</script>'), url('1'))?.coords).toEqual({
      lat: 40.1,
      lon: -3.2,
      aproximada: false,
    })
  })

  it('descripción: ignora .new-dev-promo y convierte <br>', () => {
    const d = doc(
      `<div class="new-dev-promo"><div class="comment"><div class="adCommentsLanguage">Promo</div></div></div>
       <div class="comment"><div class="adCommentsLanguage"><p>
         Hola<br>mundo &#160;</p></div></div>`,
    )
    expect(extraerAnuncio(d, url('1'))?.descripcion).toBe('Hola\nmundo')
  })
})

describe('parsearSuperficies', () => {
  it.each([
    ['90 m² construidos, 75 m² útiles', { m2Construidos: 90, m2Utiles: 75 }],
    ['1.200 m² construidos', { m2Construidos: 1200 }],
    ['85,5 m² construidos, 70,25 m² útiles', { m2Construidos: 85.5, m2Utiles: 70.25 }],
    ['Parcela de 1.500 m²', {}],
  ])('%s', (t, r) => expect(parsearSuperficies([t])).toEqual(r))
})

describe('parsearPlanta', () => {
  it.each([
    ['Planta 3ª exterior', '3'],
    ['7ª planta exterior', '7'],
    ['7ª planta', '7'],
    ['Bajo', 'bajo'],
    ['Bajo exterior', 'bajo'],
    ['Entreplanta interior', 'entreplanta'],
    ['Semi-sótano', 'sotano'],
    ['Sótano', 'sotano'],
    ['Planta -1', 'sotano'],
    [' exterior', undefined],
    ['Con ascensor', undefined],
  ])('%s → %s', (t, p) => expect(parsearPlanta(t)).toBe(p))
})

describe('parsearTipo', () => {
  it.each([
    ['Piso en venta en X', 'piso'],
    ['Ático en venta en X', 'atico'],
    ['Dúplex en venta en X', 'duplex'],
    ['Estudio en venta en X', 'estudio'],
    ['Chalet adosado en venta en X', 'casa'],
    ['Casa o chalet independiente en venta en X', 'casa'],
    ['Finca rústica en venta en X', 'otro'],
  ])('%s → %s', (t, tipo) => expect(parsearTipo(t)).toBe(tipo))
})

describe('parsearDireccion', () => {
  it.each([
    ['Calle de Mesena, 80', { via: 'Calle de Mesena', numero: '80' }],
    ['CL Valle De La Orotava, 2', { via: 'CL Valle De La Orotava', numero: '2' }],
    ['Calle de Alcalá', { via: 'Calle de Alcalá' }],
    ['Calle Mayor, s/n', { via: 'Calle Mayor' }],
    ['Calle Mayor, 12B', { via: 'Calle Mayor', numero: '12B' }],
  ])('%s', (t, r) => expect(parsearDireccion(t)).toEqual(r))
})
