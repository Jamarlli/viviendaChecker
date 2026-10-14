import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { crearClienteCatastro } from '../../adapters/catastro/cliente'
import type { Anuncio } from '../tipos'
import { emparejar, guardarSeleccion } from './flujo'
import type { Almacen, SeleccionManual } from './puertos'

const fixture = (nombre: string) => readFileSync(`fixtures/catastro/${nombre}.json`, 'utf8')

type Rutas = { dnploc?: string; rccoor?: string; dnprc?: (refCat: string) => string }

/** Cliente real sobre un fetch falso que sirve fixtures. */
function catastroFalso(rutas: Rutas, { caido = false } = {}) {
  const urls: URL[] = []
  const fn = async (u: string | URL | Request) => {
    const url = new URL(String(u))
    urls.push(url)
    if (caido) throw new Error('Failed to fetch')
    const op = url.pathname.split('/').pop()
    const nombre =
      op === 'Consulta_DNPLOC'
        ? rutas.dnploc
        : op === 'Consulta_RCCOOR_Distancia'
          ? rutas.rccoor
          : rutas.dnprc?.(url.searchParams.get('RefCat') ?? '')
    return new Response(fixture(nombre ?? 'dnprc-error'))
  }
  const ops = () => urls.map((u) => u.pathname.split('_').slice(1).join('_'))
  return { catastro: crearClienteCatastro(fn as typeof fetch), urls, ops }
}

function almacenFalso(inicial: Record<string, SeleccionManual> = {}) {
  const datos = { ...inicial }
  const almacen: Almacen = {
    leer: async (id) => datos[id],
    guardar: async (id, s) => {
      datos[id] = s
    },
  }
  return { almacen, datos }
}

const anuncio = (datos: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '42',
  url: 'https://www.idealista.com/inmueble/42/',
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  ...datos,
})

// Alcalá 100: el 0017 es el único de 126 m² (3.º CD).
const RC_3CD = '2853604VK4725D0017LM'
const datos3CD = { m2Construidos: 126, planta: '3', anio: 1930 }
const alcala100 = anuncio({
  ...datos3CD,
  direccion: { via: 'Calle de Alcalá', numero: '100' },
  municipio: 'Madrid',
  provincia: 'Madrid',
})
const centro = { lat: 40.415, lon: -3.705 }
// Fixture de Alcalá 100 servida como si fuera la parcela más cercana.
const dnprcParcela = (rc: string) => (rc === '0343111VK4704C' ? 'dnprc-parcela' : 'dnprc-error')

describe('emparejar · dirección', () => {
  it('dirección exacta y datos completos → alta y RC correcta', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios' })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: almacenFalso().almacen })
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('direccion')
    expect(r.valor.confianza).toBe('alta')
    expect(r.valor.candidatos[0]?.inmueble.rc).toBe(RC_3CD)
    expect(r.valor.candidatos).toHaveLength(34)
  })

  it('consulta DNPLOC con sigla y calle extraídas de la vía', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios' })
    await emparejar(alcala100, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(c.ops()).toEqual(['DNPLOC'])
    expect(Object.fromEntries(c.urls[0]?.searchParams ?? [])).toMatchObject({
      Provincia: 'Madrid',
      Municipio: 'Madrid',
      Sigla: 'CL',
      Calle: 'ALCALA',
      Numero: '100',
    })
  })

  it('no residenciales se puntúan, no se descartan', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios' })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: almacenFalso().almacen })
    if (!r.ok) throw new Error()
    expect(r.valor.candidatos.some((x) => x.inmueble.uso === 'Comercial')).toBe(true)
  })

  it('dirección sin resultados y con coords → coords', async () => {
    const c = catastroFalso({
      dnploc: 'dnploc-via-inexistente',
      rccoor: 'rccoor-varias',
      dnprc: dnprcParcela,
    })
    const a = { ...alcala100, coords: { ...centro, aproximada: false } }
    const r = await emparejar(a, { catastro: c.catastro, almacen: almacenFalso().almacen })
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('coords')
    expect(c.ops()[0]).toBe('DNPLOC')
  })

  it('dirección sin resultados y sin coords → ninguna', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-numero-inexistente' })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(r).toEqual({
      ok: true,
      valor: { candidatos: [], confianza: 'ninguna', origen: 'direccion' },
    })
  })
})

describe('emparejar · coords', () => {
  const sinNumero = anuncio({
    ...datos3CD,
    direccion: { via: 'Calle de Alcalá' },
    provincia: 'Madrid',
    coords: { ...centro, aproximada: false },
  })

  it('sin número pero con coords → candidatos de parcelas cercanas', async () => {
    const c = catastroFalso({ rccoor: 'rccoor-varias', dnprc: dnprcParcela })
    const r = await emparejar(sinNumero, { catastro: c.catastro, almacen: almacenFalso().almacen })
    if (!r.ok) throw new Error()
    expect(c.ops()).toEqual(['RCCOOR_Distancia', ...Array(10).fill('DNPRC')])
    expect(c.urls[1]?.searchParams.get('RefCat')).toBe('0343111VK4704C')
    expect(r.valor.origen).toBe('coords')
    expect(r.valor.candidatos[0]?.inmueble.rc).toBe(RC_3CD)
    expect(r.valor.confianza).toBe('alta')
  })

  it('coords aproximadas → nunca alta', async () => {
    const c = catastroFalso({ rccoor: 'rccoor-varias', dnprc: dnprcParcela })
    const a = { ...sinNumero, coords: { ...centro, aproximada: true } }
    const r = await emparejar(a, { catastro: c.catastro, almacen: almacenFalso().almacen })
    if (!r.ok) throw new Error()
    expect(r.valor.candidatos[0]?.inmueble.rc).toBe(RC_3CD)
    expect(r.valor.confianza).toBe('media')
  })

  it('sin parcelas cercanas → ninguna', async () => {
    const c = catastroFalso({ rccoor: 'rccoor-vacia' })
    const r = await emparejar(sinNumero, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(r).toEqual({
      ok: true,
      valor: { candidatos: [], confianza: 'ninguna', origen: 'coords' },
    })
  })

  it('ni dirección completa ni coords → ninguna, sin consultar', async () => {
    const c = catastroFalso({})
    const r = await emparejar(anuncio({ direccion: { via: 'Calle Mayor' } }), {
      catastro: c.catastro,
      almacen: almacenFalso().almacen,
    })
    expect(r).toEqual({
      ok: true,
      valor: { candidatos: [], confianza: 'ninguna', origen: 'direccion' },
    })
    expect(c.urls).toEqual([])
  })
})

describe('emparejar · errores', () => {
  it('Catastro caído → error de red, sin lanzar', async () => {
    const c = catastroFalso({}, { caido: true })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(r).toMatchObject({ ok: false, error: { tipo: 'red' } })
  })

  it('error de API en una parcela → error', async () => {
    const c = catastroFalso({
      rccoor: 'rccoor-varias',
      dnprc: (rc) => (rc === '0342202VK4704A' ? 'dnprc-rc-invalida' : 'dnprc-error'),
    })
    const a = anuncio({ coords: { ...centro, aproximada: false } })
    const r = await emparejar(a, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(r).toMatchObject({ ok: false, error: { tipo: 'api' } })
  })

  it('provincia foral → noSoportado', async () => {
    const c = catastroFalso({})
    const a = { ...alcala100, provincia: 'Bizkaia', coords: { ...centro, aproximada: false } }
    const r = await emparejar(a, { catastro: c.catastro, almacen: almacenFalso().almacen })
    expect(r).toEqual({ ok: false, error: { tipo: 'noSoportado' } })
    expect(c.urls).toEqual([])
  })
})

describe('emparejar · manual', () => {
  it('selección guardada tiene prioridad (origen manual)', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios', dnprc: () => 'dnprc-rc' })
    const { almacen } = almacenFalso({ '42': { rc: '2853604VK4725D0001YP' } })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen })
    expect(c.ops()).toEqual(['DNPRC'])
    expect(c.urls[0]?.searchParams.get('RefCat')).toBe('2853604VK4725D0001YP')
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('manual')
    expect(r.valor.confianza).toBe('alta')
    expect(r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['2853604VK4725D0001YP'])
  })

  it('solo aplica a su anuncio', async () => {
    const c = catastroFalso({ dnploc: 'dnploc-varios' })
    const { almacen } = almacenFalso({ otro: { rc: '2853604VK4725D0001YP' } })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen })
    expect(r.ok && r.valor.origen).toBe('direccion')
  })

  it('RC guardada inexistente → ninguna', async () => {
    const c = catastroFalso({ dnprc: () => 'dnprc-error' })
    const { almacen } = almacenFalso({ '42': { rc: '2853604VK4725D9999ZZ' } })
    const r = await emparejar(alcala100, { catastro: c.catastro, almacen })
    expect(r).toEqual({
      ok: true,
      valor: { candidatos: [], confianza: 'ninguna', origen: 'manual' },
    })
  })
})

describe('guardarSeleccion', () => {
  it('normaliza la RC pegada y la guarda por id de anuncio', async () => {
    const { almacen, datos } = almacenFalso()
    expect(await guardarSeleccion(almacen, '42', ' 2853604 vk4725d 0001 yp ')).toBe(true)
    expect(datos['42']).toEqual({ rc: '2853604VK4725D0001YP' })
  })

  it.each(['', '2853604VK4725D', '2853604VK4725D0001Y', '2853604VK4725D0001Y-'])(
    'rechaza RC no válida %j',
    async (rc) => {
      const { almacen, datos } = almacenFalso()
      expect(await guardarSeleccion(almacen, '42', rc)).toBe(false)
      expect(datos).toEqual({})
    },
  )
})
