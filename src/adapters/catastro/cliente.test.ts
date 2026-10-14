import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearClienteCatastro, esProvinciaForal, TIEMPO_WFS_MS } from './cliente'

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

  it('vía inexistente → sinResultados', async () => {
    const f = fetchFalso(fixture('dnploc-via-inexistente'))
    const r = await crearClienteCatastro(f.fn).buscarPorDireccion(alcala100)
    expect(r).toEqual({
      ok: false,
      error: { tipo: 'sinResultados', mensaje: 'LA VÍA NO EXISTE' },
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

const xml = (nombre: string) => readFileSync(`fixtures/catastro/${nombre}.xml`, 'utf8')

describe('parcelasEnRadio (WFS INSPIRE)', () => {
  const sol = { lat: 40.4168, lon: -3.70375 }

  it('pide un BBOX de lado 2·radio en EPSG:4326 (lat,lon)', async () => {
    const f = fetchFalso(xml('wfs-cp-parcelas'))
    await crearClienteCatastro(f.fn).parcelasEnRadio(sol, 250)
    const url = new URL(f.urls[0] ?? '')
    expect(url.origin + url.pathname).toBe('https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx')
    const q = Object.fromEntries(url.searchParams)
    expect(q).toMatchObject({
      service: 'WFS',
      request: 'GetFeature',
      typeNames: 'cp:CadastralParcel',
      srsName: 'EPSG::4326',
    })
    const [latMin = 0, lonMin = 0, latMax = 0, lonMax = 0] = (q.bbox ?? '').split(',').map(Number)
    const coseno = Math.cos((sol.lat * Math.PI) / 180)
    expect(((latMax - latMin) * 111320) / 2).toBeCloseTo(250, -1)
    expect(((lonMax - lonMin) * 111320 * coseno) / 2).toBeCloseTo(250, -1)
    expect((latMax + latMin) / 2).toBeCloseTo(sol.lat, 5)
  })

  it('devuelve las parcelas (14 car.) ordenadas por distancia al punto de referencia', async () => {
    const f = fetchFalso(xml('wfs-cp-parcelas'))
    const r = await crearClienteCatastro(f.fn).parcelasEnRadio(sol, 250)
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toHaveLength(17)
    expect(r.valor[0]).toEqual({ pc: '0444101VK4704C', direccion: '', distancia: 51 })
    expect(r.valor.every((p) => /^[0-9A-Z]{14}$/.test(p.pc))).toBe(true)
    const ds = r.valor.map((p) => p.distancia)
    expect(ds).toEqual([...ds].sort((a, b) => a - b))
  })

  it('sin parcelas → sinResultados', async () => {
    const r = await crearClienteCatastro(fetchFalso(xml('wfs-cp-vacia')).fn).parcelasEnRadio(
      sol,
      250,
    )
    expect(r.ok === false && r.error.tipo).toBe('sinResultados')
  })

  it('otra excepción → api', async () => {
    const r = await crearClienteCatastro(fetchFalso(xml('wfs-cp-error')).fn).parcelasEnRadio(
      sol,
      250,
    )
    expect(r).toEqual({
      ok: false,
      error: { tipo: 'api', mensaje: 'One or more BBOX values are null' },
    })
  })

  it('respuesta no GML → api; HTTP 500 → red', async () => {
    const r1 = await crearClienteCatastro(fetchFalso('<html/>').fn).parcelasEnRadio(sol, 250)
    expect(r1.ok === false && r1.error.tipo).toBe('api')
    const r2 = await crearClienteCatastro(fetchFalso('', 500).fn).parcelasEnRadio(sol, 250)
    expect(r2.ok === false && r2.error.tipo).toBe('red')
  })

  it('descarta parcelas a más de radioM', async () => {
    const r = await crearClienteCatastro(fetchFalso(xml('wfs-cp-parcelas')).fn).parcelasEnRadio(
      sol,
      60,
    )
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor.length).toBeGreaterThan(0)
    expect(r.valor.length).toBeLessThan(17)
    expect(r.valor.every((p) => p.distancia <= 60)).toBe(true)
  })

  describe('cortes', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    // fetch que solo termina si se aborta.
    const colgado = (async (_: unknown, init?: RequestInit) =>
      new Promise((_, rechazar) =>
        init?.signal?.addEventListener('abort', () => rechazar(init.signal?.reason)),
      )) as typeof fetch

    it('sin respuesta en TIEMPO_WFS_MS → red', async () => {
      vi.useFakeTimers()
      const p = crearClienteCatastro(colgado).parcelasEnRadio(sol, 250)
      await vi.advanceTimersByTimeAsync(TIEMPO_WFS_MS)
      expect(await p).toEqual({ ok: false, error: { tipo: 'red', mensaje: 'Tiempo agotado' } })
    })

    it('señal abortada → red, sin esperar', async () => {
      const ctrl = new AbortController()
      const p = crearClienteCatastro(colgado).parcelasEnRadio(sol, 250, undefined, ctrl.signal)
      ctrl.abort()
      expect(await p).toMatchObject({ ok: false, error: { tipo: 'red' } })
    })

    it('la señal llega al fetch del callejero', async () => {
      const ctrl = new AbortController()
      const p = crearClienteCatastro(colgado).buscarPorReferencia('2853604VK4725D', ctrl.signal)
      ctrl.abort()
      expect(await p).toMatchObject({ ok: false, error: { tipo: 'red' } })
    })
  })

  it('provincia foral → noSoportado', async () => {
    const f = fetchFalso('')
    const r = await crearClienteCatastro(f.fn).parcelasEnRadio(sol, 250, 'Navarra')
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

  it('superficie con punto de miles ("1.149") → 1149', async () => {
    const f = fetchFalso(fixture('dnprc-sfc-miles'))
    const r = await crearClienteCatastro(f.fn).buscarPorReferencia('2565814VK4726F')
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor.find((i) => i.rc === '2565814VK4726F0002OM')?.m2).toBe(1149)
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
    const r = await consultar(fetchFalso(fixture('dnprc-rc-invalida')).fn)
    expect(r).toEqual({
      ok: false,
      error: {
        tipo: 'api',
        codigo: '3',
        mensaje: 'LA REFERENCIA CATASTRAL DEBE TENER 14,18 o 20 POSICIONES',
      },
    })
  })
})

describe('buscarNumeros (ObtenerNumerero)', () => {
  it('construye la URL con TipoVia y NomVia', async () => {
    const f = fetchFalso(fixture('numerero-alcala-100'))
    await crearClienteCatastro(f.fn).buscarNumeros(alcala100)
    const url = new URL(f.urls[0] ?? '')
    expect(url.pathname).toMatch(/COVCCallejero\.svc\/json\/ObtenerNumerero$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      Provincia: 'MADRID',
      Municipio: 'MADRID',
      TipoVia: 'CL',
      NomVia: 'ALCALA',
      Numero: '100',
    })
  })

  it('número existente → ese número y su parcela', async () => {
    const f = fetchFalso(fixture('numerero-alcala-100'))
    const r = await crearClienteCatastro(f.fn).buscarNumeros(alcala100)
    expect(r).toEqual({ ok: true, valor: [{ numero: '100', pc: '2853604VK4725D' }] })
  })

  it('número inexistente → números cercanos sin duplicados', async () => {
    const f = fetchFalso(fixture('numerero-alcala-103'))
    const r = await crearClienteCatastro(f.fn).buscarNumeros({ ...alcala100, numero: '103' })
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor.map((n) => n.numero)).toEqual([
      '98',
      '99',
      '100',
      '101',
      '102',
      '104',
      '105',
      '106',
      '107',
      '108',
    ])
  })

  it('sin número → consulta 0 (primeros números)', async () => {
    const f = fetchFalso(fixture('numerero-alcala-0'))
    const r = await crearClienteCatastro(f.fn).buscarNumeros({ ...alcala100, numero: '' })
    expect(new URL(f.urls[0] ?? '').searchParams.get('Numero')).toBe('0')
    if (!r.ok) throw new Error('esperaba ok')
    expect(r.valor).toHaveLength(4)
  })

  it('sin cercanos → sinResultados', async () => {
    const f = fetchFalso(fixture('numerero-alcala-9999'))
    const r = await crearClienteCatastro(f.fn).buscarNumeros({ ...alcala100, numero: '9999' })
    expect(r).toMatchObject({ ok: false, error: { tipo: 'sinResultados' } })
  })

  it('vía inexistente → sinResultados', async () => {
    const f = fetchFalso(fixture('numerero-via-inexistente'))
    const r = await crearClienteCatastro(f.fn).buscarNumeros(alcala100)
    expect(r).toMatchObject({ ok: false, error: { tipo: 'sinResultados' } })
  })

  it('provincia foral → noSoportado sin llamar a la red', async () => {
    const f = fetchFalso('')
    const r = await crearClienteCatastro(f.fn).buscarNumeros({
      ...alcala100,
      provincia: 'Navarra',
    })
    expect(r).toEqual({ ok: false, error: { tipo: 'noSoportado' } })
    expect(f.urls).toHaveLength(0)
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
    'Comunidad Foral de Navarra',
  ])('%s → sí', (p) => expect(esProvinciaForal(p)).toBe(true))

  it.each(['Madrid', 'Cantabria', 'La Rioja', ''])('%s → no', (p) =>
    expect(esProvinciaForal(p)).toBe(false),
  )
})
