import { describe, expect, it } from 'vitest'
import type { Anuncio, Inmueble } from '../tipos'
import { emparejar, guardarSeleccion } from './flujo'
import type {
  Almacen,
  ClienteCatastro,
  ErrorCatastro,
  Localizacion,
  Parcela,
  Resultado,
  SeleccionManual,
} from './puertos'

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor })
const err = (error: ErrorCatastro): Resultado<never> => ({ ok: false, error })
const vacio = err({ tipo: 'sinResultados', mensaje: '' })

const inmueble = (rc: string, datos: Partial<Inmueble> = {}): Inmueble => ({
  rc,
  uso: 'Residencial',
  m2: 80,
  anio: 1990,
  planta: '02',
  puerta: 'A',
  direccion: '',
  ...datos,
})

const BUENO = inmueble('BUENO', { m2: 100, planta: '01', anio: 2000 })
const OTROS = [inmueble('OTRO1'), inmueble('LOCAL', { uso: 'Comercial', planta: '00' })]

type Respuestas = {
  direccion?: Resultado<Inmueble[]>
  coordenadas?: Resultado<Parcela[]>
  referencia?: (ref: string) => Resultado<Inmueble[]>
}

/** Implementa el puerto y registra las llamadas. */
function catastroFalso(r: Respuestas = {}) {
  const llamadas: { op: string; arg: unknown }[] = []
  const catastro: ClienteCatastro = {
    async buscarNumeros(l) {
      llamadas.push({ op: 'numeros', arg: l })
      return vacio
    },
    async buscarPorDireccion(l: Localizacion) {
      llamadas.push({ op: 'direccion', arg: l })
      return r.direccion ?? vacio
    },
    async buscarPorCoordenadas(c, provincia) {
      llamadas.push({ op: 'coordenadas', arg: { ...c, provincia } })
      return r.coordenadas ?? vacio
    },
    async buscarPorReferencia(ref) {
      llamadas.push({ op: 'referencia', arg: ref })
      return r.referencia?.(ref) ?? vacio
    },
  }
  return { catastro, llamadas, ops: () => llamadas.map((l) => l.op) }
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
  m2Construidos: 100,
  planta: '1',
  anio: 2000,
  ...datos,
})

const coords = (aproximada = false) => ({ lat: 40.4, lon: -3.7, aproximada })
const conDireccion = anuncio({
  direccion: { via: 'Calle de Alcalá', numero: '100' },
  municipio: 'Madrid',
  provincia: 'Madrid',
})
const soloCoords = anuncio({ provincia: 'Madrid', coords: coords() })
const parcela = (pc: string, distancia: number): Parcela => ({ pc, direccion: '', distancia })
const deps = (catastro: ClienteCatastro, almacen = almacenFalso().almacen) => ({
  catastro,
  almacen,
})

describe('emparejar · dirección', () => {
  it('candidato claro → alta, ordenado y sin descartar no residenciales', async () => {
    const c = catastroFalso({ direccion: ok([...OTROS, BUENO]) })
    const r = await emparejar(conDireccion, deps(c.catastro))
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('direccion')
    expect(r.valor.confianza).toBe('alta')
    expect(r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO', 'OTRO1', 'LOCAL'])
  })

  it('pasa sigla y calle extraídas de la vía', async () => {
    const c = catastroFalso({ direccion: ok([BUENO]) })
    await emparejar(conDireccion, deps(c.catastro))
    expect(c.llamadas).toEqual([
      {
        op: 'direccion',
        arg: {
          provincia: 'Madrid',
          municipio: 'Madrid',
          sigla: 'CL',
          calle: 'ALCALA',
          numero: '100',
        },
      },
    ])
  })

  it('sin resultados y con coords → coords', async () => {
    const c = catastroFalso({
      coordenadas: ok([parcela('P1', 1)]),
      referencia: () => ok([BUENO]),
    })
    const r = await emparejar({ ...conDireccion, coords: coords() }, deps(c.catastro))
    expect(c.ops()).toEqual(['direccion', 'coordenadas', 'referencia'])
    expect(r.ok && r.valor.origen).toBe('coords')
  })

  it('sin resultados y sin coords → ninguna', async () => {
    const r = await emparejar(conDireccion, deps(catastroFalso().catastro))
    expect(r).toEqual(ok({ candidatos: [], confianza: 'ninguna', origen: 'direccion' }))
  })

  it('sin provincia o municipio → no consulta por dirección', async () => {
    const c = catastroFalso()
    await emparejar({ ...conDireccion, municipio: undefined }, deps(c.catastro))
    expect(c.ops()).toEqual([])
  })
})

describe('emparejar · coords', () => {
  it('sin número → DNPRC de cada parcela cercana', async () => {
    const c = catastroFalso({
      coordenadas: ok([parcela('P1', 1), parcela('P2', 5)]),
      referencia: (pc) => ok(pc === 'P1' ? [BUENO] : OTROS),
    })
    const r = await emparejar(
      { ...soloCoords, direccion: { via: 'Calle Mayor' } },
      deps(c.catastro),
    )
    expect(c.llamadas[0]).toEqual({
      op: 'coordenadas',
      arg: { lat: 40.4, lon: -3.7, provincia: 'Madrid' },
    })
    expect(c.llamadas.slice(1).map((l) => l.arg)).toEqual(['P1', 'P2'])
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('coords')
    expect(r.valor.candidatos).toHaveLength(3)
    expect(r.valor.confianza).toBe('alta')
  })

  it('aproximadas → nunca alta', async () => {
    const c = catastroFalso({ coordenadas: ok([parcela('P1', 1)]), referencia: () => ok([BUENO]) })
    const r = await emparejar({ ...soloCoords, coords: coords(true) }, deps(c.catastro))
    expect(r.ok && r.valor.confianza).toBe('media')
  })

  it('solo las 10 parcelas más cercanas', async () => {
    const parcelas = Array.from({ length: 12 }, (_, i) => parcela(`P${i}`, 12 - i))
    const c = catastroFalso({ coordenadas: ok(parcelas), referencia: () => ok([BUENO]) })
    await emparejar(soloCoords, deps(c.catastro))
    const consultadas = c.llamadas.filter((l) => l.op === 'referencia').map((l) => l.arg)
    expect(consultadas).toEqual(['P11', 'P10', 'P9', 'P8', 'P7', 'P6', 'P5', 'P4', 'P3', 'P2'])
  })

  it('una parcela falla → se descarta y sigue con las demás', async () => {
    const c = catastroFalso({
      coordenadas: ok([parcela('P1', 1), parcela('P2', 2), parcela('P3', 3)]),
      referencia: (pc) =>
        pc === 'P1'
          ? err({ tipo: 'api', codigo: '3', mensaje: 'x' })
          : pc === 'P2'
            ? err({ tipo: 'red', mensaje: 'x' })
            : ok([BUENO]),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r.ok && r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO'])
  })

  it('fallan todas → error', async () => {
    const c = catastroFalso({
      coordenadas: ok([parcela('P1', 1), parcela('P2', 2)]),
      referencia: (pc) => (pc === 'P1' ? vacio : err({ tipo: 'red', mensaje: 'x' })),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r).toEqual(err({ tipo: 'red', mensaje: 'x' }))
  })

  it('todas sin inmuebles → ninguna', async () => {
    const c = catastroFalso({ coordenadas: ok([parcela('P1', 1)]) })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r).toEqual(ok({ candidatos: [], confianza: 'ninguna', origen: 'coords' }))
  })

  it('sin parcelas cercanas → ninguna', async () => {
    const r = await emparejar(soloCoords, deps(catastroFalso().catastro))
    expect(r).toEqual(ok({ candidatos: [], confianza: 'ninguna', origen: 'coords' }))
  })
})

describe('emparejar · sin datos', () => {
  it("ni dirección completa ni coords → ninguna, origen 'ninguno', sin consultar", async () => {
    const c = catastroFalso()
    const r = await emparejar(anuncio({ direccion: { via: 'Calle Mayor' } }), deps(c.catastro))
    expect(r).toEqual(ok({ candidatos: [], confianza: 'ninguna', origen: 'ninguno' }))
    expect(c.ops()).toEqual([])
  })
})

describe('emparejar · errores', () => {
  it.each<ErrorCatastro>([
    { tipo: 'red', mensaje: 'caído' },
    { tipo: 'api', codigo: '99', mensaje: 'x' },
    { tipo: 'noSoportado' },
  ])('dirección con error %j → se propaga sin lanzar ni probar coords', async (e) => {
    const c = catastroFalso({ direccion: err(e) })
    const r = await emparejar({ ...conDireccion, coords: coords() }, deps(c.catastro))
    expect(r).toEqual(err(e))
    expect(c.ops()).toEqual(['direccion'])
  })

  it('coords con error → se propaga', async () => {
    const c = catastroFalso({ coordenadas: err({ tipo: 'noSoportado' }) })
    expect(await emparejar(soloCoords, deps(c.catastro))).toEqual(err({ tipo: 'noSoportado' }))
  })
})

describe('emparejar · manual', () => {
  it('selección guardada tiene prioridad (origen manual, alta)', async () => {
    const c = catastroFalso({
      direccion: ok([BUENO]),
      referencia: () => ok([OTROS[1] as Inmueble]),
    })
    const { almacen } = almacenFalso({ '42': { rc: 'LOCAL' } })
    const r = await emparejar(conDireccion, deps(c.catastro, almacen))
    expect(c.llamadas).toEqual([{ op: 'referencia', arg: 'LOCAL' }])
    expect(r).toEqual(
      ok({
        candidatos: [{ inmueble: OTROS[1], puntuacion: 0 }],
        confianza: 'alta',
        origen: 'manual',
      }),
    )
  })

  it('solo aplica a su anuncio', async () => {
    const c = catastroFalso({ direccion: ok([BUENO]) })
    const { almacen } = almacenFalso({ otro: { rc: 'LOCAL' } })
    const r = await emparejar(conDireccion, deps(c.catastro, almacen))
    expect(r.ok && r.valor.origen).toBe('direccion')
  })

  it('RC guardada inexistente → ninguna', async () => {
    const { almacen } = almacenFalso({ '42': { rc: 'X' } })
    const r = await emparejar(conDireccion, deps(catastroFalso().catastro, almacen))
    expect(r).toEqual(ok({ candidatos: [], confianza: 'ninguna', origen: 'manual' }))
  })

  it('error al consultar la RC guardada → se propaga', async () => {
    const c = catastroFalso({ referencia: () => err({ tipo: 'red', mensaje: 'x' }) })
    const { almacen } = almacenFalso({ '42': { rc: 'X' } })
    const r = await emparejar(conDireccion, deps(c.catastro, almacen))
    expect(r).toEqual(err({ tipo: 'red', mensaje: 'x' }))
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
