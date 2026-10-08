import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { crearClienteCatastro, esProvinciaForal } from './cliente'

const fixture = (nombre: string) => readFileSync(`fixtures/catastro/${nombre}.json`, 'utf8')

function fetchFalso(cuerpo: string, status = 200) {
  const urls: string[] = []
  const fn = async (url: string | URL | Request) => {
    urls.push(String(url))
    return new Response(cuerpo, { status })
  }
  return { fn: fn as typeof fetch, urls }
}

const alcala100 = {
  provincia: 'MADRID',
  municipio: 'MADRID',
  sigla: 'CL',
  calle: 'ALCALA',
  numero: '100',
}

describe('buscarPorDireccion (DNPLOC)', () => {
  it('construye la URL con los parámetros', async () => {
    const f = fetchFalso(fixture('dnploc-varios'))
    await crearClienteCatastro(f.fn).buscarPorDireccion(alcala100)
    const url = new URL(f.urls[0] ?? '')
    expect(url.pathname).toMatch(/COVCCallejero\.svc\/json\/Consulta_DNPLOC$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      Provincia: 'MADRID',
      Municipio: 'MADRID',
      Sigla: 'CL',
      Calle: 'ALCALA',
      Numero: '100',
    })
  })

  it('mapea una dirección con varios inmuebles', async () => {
    const f = fetchFalso(fixture('dnploc-varios'))
    const r = await crearClienteCatastro(f.fn).buscarPorDireccion(alcala100)
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toHaveLength(34)
    expect(r.valor[0]).toEqual({
      rc: '2853604VK4725D0001YP',
      uso: 'Comercial',
      m2: 41,
      anio: 1930,
      planta: '00',
      puerta: 'B',
      direccion: 'CL ALCALA 100, MADRID',
    })
  })

  it('acepta un solo inmueble (objeto bico en vez de lista)', async () => {
    const f = fetchFalso(fixture('dnploc-uno'))
    const r = await crearClienteCatastro(f.fn).buscarPorDireccion(alcala100)
    expect(r).toEqual({
      ok: true,
      valor: [
        {
          rc: '5626101VK2852N0002JB',
          uso: 'Residencial',
          m2: 304,
          anio: 1987,
          planta: '00',
          puerta: '05',
          direccion: 'CL PRINCIPADO DE ASTURIAS 5, LAS ROZAS DE MADRID',
        },
      ],
    })
  })

  it('número inexistente → sinResultados', async () => {
    const f = fetchFalso(fixture('dnploc-numero-inexistente'))
    const r = await crearClienteCatastro(f.fn).buscarPorDireccion(alcala100)
    expect(r).toEqual({
      ok: false,
      error: { tipo: 'sinResultados', mensaje: 'EL NUMERO NO EXISTE' },
    })
  })

  it('provincia foral → noSoportado sin llamar a la red', async () => {
    const f = fetchFalso('')
    const r = await crearClienteCatastro(f.fn).buscarPorDireccion({
      ...alcala100,
      provincia: 'Bizkaia',
    })
    expect(r).toEqual({ ok: false, error: { tipo: 'noSoportado' } })
    expect(f.urls).toHaveLength(0)
  })
})

describe('buscarPorCoordenadas (RCCOOR_Distancia)', () => {
  it('lon → CoorX, lat → CoorY, EPSG:4326', async () => {
    const f = fetchFalso(fixture('rccoor-varias'))
    await crearClienteCatastro(f.fn).buscarPorCoordenadas({ lat: 40.415, lon: -3.705 })
    const url = new URL(f.urls[0] ?? '')
    expect(url.pathname).toMatch(/COVCCoordenadas\.svc\/json\/Consulta_RCCOOR_Distancia$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      CoorX: '-3.705',
      CoorY: '40.415',
      SRS: 'EPSG:4326',
    })
  })

  it('devuelve las parcelas cercanas ordenadas por distancia', async () => {
    const f = fetchFalso(fixture('rccoor-varias'))
    const r = await crearClienteCatastro(f.fn).buscarPorCoordenadas({ lat: 40.415, lon: -3.705 })
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toHaveLength(10)
    expect(r.valor[0]).toEqual({
      pc: '0343111VK4704C',
      direccion: 'CL BOLSA 12 MADRID (MADRID)',
      distancia: 3.18,
    })
  })

  it('sin parcelas → sinResultados', async () => {
    const f = fetchFalso(fixture('rccoor-vacia'))
    const r = await crearClienteCatastro(f.fn).buscarPorCoordenadas({ lat: 43.263, lon: -2.935 })
    expect(r.ok === false && r.error.tipo).toBe('sinResultados')
  })

  it('provincia foral → noSoportado', async () => {
    const f = fetchFalso('')
    const r = await crearClienteCatastro(f.fn).buscarPorCoordenadas(
      { lat: 43.263, lon: -2.935 },
      'Bizkaia',
    )
    expect(r).toEqual({ ok: false, error: { tipo: 'noSoportado' } })
    expect(f.urls).toHaveLength(0)
  })
})

describe('buscarPorReferencia (DNPRC)', () => {
  it('parcela (14 car.) → todos sus inmuebles', async () => {
    const f = fetchFalso(fixture('dnprc-parcela'))
    const r = await crearClienteCatastro(f.fn).buscarPorReferencia('2853604VK4725D')
    expect(new URL(f.urls[0] ?? '').searchParams.get('RefCat')).toBe('2853604VK4725D')
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toHaveLength(34)
  })

  it('RC (20 car.) → un inmueble', async () => {
    const f = fetchFalso(fixture('dnprc-rc'))
    const r = await crearClienteCatastro(f.fn).buscarPorReferencia('2853604VK4725D0001YP')
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toEqual([
      {
        rc: '2853604VK4725D0001YP',
        uso: 'Comercial',
        m2: 41,
        anio: 1930,
        planta: '00',
        puerta: 'B',
        direccion: 'CL ALCALA 100, MADRID',
      },
    ])
  })

  it('"no existe ningún inmueble" → sinResultados', async () => {
    const f = fetchFalso(fixture('dnprc-error'))
    const r = await crearClienteCatastro(f.fn).buscarPorReferencia('0000000XX0000X')
    expect(r).toEqual({
      ok: false,
      error: {
        tipo: 'sinResultados',
        mensaje: 'NO EXISTE NINGÚN INMUEBLE CON LOS PARÁMETROS INDICADOS',
      },
    })
  })
})

describe('errores', () => {
  const consultar = (fn: typeof fetch) => crearClienteCatastro(fn).buscarPorReferencia('X')

  it('fallo de red → red', async () => {
    const r = await consultar(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(r).toEqual({ ok: false, error: { tipo: 'red', mensaje: 'Failed to fetch' } })
  })

  it('HTTP no 2xx → red', async () => {
    const r = await consultar(fetchFalso('', 503).fn)
    expect(r).toEqual({ ok: false, error: { tipo: 'red', mensaje: 'HTTP 503' } })
  })

  it('JSON inválido → api', async () => {
    const r = await consultar(fetchFalso('<html>').fn)
    expect(r.ok === false && r.error.tipo).toBe('api')
  })

  it('otro error de la API → api con código', async () => {
    const r = await consultar(fetchFalso(fixture('dnploc-numero-invalido')).fn)
    expect(r).toEqual({
      ok: false,
      error: {
        tipo: 'api',
        codigo: '42',
        mensaje: 'EL NÚMERO DEBE SER UNA SECUENCIA DE HASTA 4 DÍGITOS.',
      },
    })
  })
})

describe('esProvinciaForal', () => {
  it.each([
    'Álava',
    'ARABA',
    'Araba/Álava',
    'Bizkaia',
    'Vizcaya',
    'Gipuzkoa',
    'Guipúzcoa',
    'Navarra',
    'Nafarroa',
  ])('%s → sí', (p) => expect(esProvinciaForal(p)).toBe(true))

  it.each(['Madrid', 'Cantabria', 'La Rioja', ''])('%s → no', (p) =>
    expect(esProvinciaForal(p)).toBe(false),
  )
})
