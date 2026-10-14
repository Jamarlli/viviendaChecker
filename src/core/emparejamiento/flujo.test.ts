import { describe, expect, it } from 'vitest'
import type { Anuncio, Inmueble } from '../tipos'
import { CONCURRENCIA_DNPRC } from './constantes'
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
  radio?: Resultado<Parcela[]>
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
    async parcelasEnRadio(c, radioM, provincia) {
      llamadas.push({ op: 'radio', arg: { ...c, radioM, provincia } })
      return r.radio ?? vacio
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
      radio: ok([parcela('P1', 1)]),
      referencia: () => ok([BUENO]),
    })
    const r = await emparejar({ ...conDireccion, coords: coords() }, deps(c.catastro))
    expect(c.ops()).toEqual(['direccion', 'radio', 'referencia'])
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
  it('sin número → parcelas a ≤ 250 m y DNPRC de cada una', async () => {
    const c = catastroFalso({
      radio: ok([parcela('P2', 5), parcela('P1', 1)]),
      referencia: (pc) => ok(pc === 'P1' ? [BUENO] : OTROS),
    })
    const r = await emparejar(
      { ...soloCoords, direccion: { via: 'Calle Mayor' } },
      deps(c.catastro),
    )
    expect(c.llamadas[0]).toEqual({
      op: 'radio',
      arg: { lat: 40.4, lon: -3.7, radioM: 250, provincia: 'Madrid' },
    })
    expect(c.llamadas.slice(1).map((l) => l.arg)).toEqual(['P1', 'P2'])
    if (!r.ok) throw new Error()
    expect(r.valor.origen).toBe('coords')
    // OTROS no caben en ±15 % de 100 m².
    expect(r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO'])
    expect(r.valor.confianza).toBe('alta')
  })

  it.each<ErrorCatastro>([
    { tipo: 'red', mensaje: 'x' },
    { tipo: 'api', mensaje: 'x' },
    { tipo: 'sinResultados', mensaje: '' },
  ])('WFS con %j → RCCOOR_Distancia', async (e) => {
    const c = catastroFalso({
      radio: err(e),
      coordenadas: ok([parcela('P1', 1)]),
      referencia: () => ok([BUENO]),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(c.ops()).toEqual(['radio', 'coordenadas', 'referencia'])
    expect(c.llamadas[1]?.arg).toEqual({ lat: 40.4, lon: -3.7, provincia: 'Madrid' })
    expect(r.ok && r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO'])
  })

  it('con superficie, descarta inmuebles fuera de ±15 % antes de puntuar', async () => {
    const c = catastroFalso({
      radio: ok([parcela('P1', 1)]),
      referencia: () => ok([BUENO, inmueble('GRANDE', { m2: 116 }), inmueble('JUSTO', { m2: 85 })]),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r.ok && r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO', 'JUSTO'])
  })

  it('si ninguno cumple la superficie, puntúa todos', async () => {
    const c = catastroFalso({ radio: ok([parcela('P1', 1)]), referencia: () => ok(OTROS) })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r.ok && r.valor.candidatos).toHaveLength(2)
  })

  it('sin superficie en el anuncio, no filtra', async () => {
    const c = catastroFalso({ radio: ok([parcela('P1', 1)]), referencia: () => ok(OTROS) })
    const a = { ...soloCoords, m2Construidos: undefined }
    const r = await emparejar(a, deps(c.catastro))
    expect(r.ok && r.valor.candidatos).toHaveLength(2)
  })

  it('a igual puntuación, primero la parcela más cercana', async () => {
    const c = catastroFalso({
      radio: ok([parcela('LEJOS', 200), parcela('CERCA', 3)]),
      referencia: (pc) => ok([inmueble(pc, { m2: 100, planta: '01', anio: 2000 })]),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r.ok && r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['CERCA', 'LEJOS'])
  })

  it('aproximadas → nunca alta', async () => {
    const c = catastroFalso({ radio: ok([parcela('P1', 1)]), referencia: () => ok([BUENO]) })
    const r = await emparejar({ ...soloCoords, coords: coords(true) }, deps(c.catastro))
    expect(r.ok && r.valor.confianza).toBe('media')
  })

  it('solo las 25 parcelas más cercanas', async () => {
    const parcelas = Array.from({ length: 30 }, (_, i) => parcela(`P${i}`, 30 - i))
    const c = catastroFalso({ radio: ok(parcelas), referencia: () => ok([BUENO]) })
    await emparejar(soloCoords, deps(c.catastro))
    const consultadas = c.llamadas.filter((l) => l.op === 'referencia').map((l) => l.arg)
    expect(consultadas).toEqual(Array.from({ length: 25 }, (_, i) => `P${29 - i}`))
  })

  it('una parcela falla → se descarta y sigue con las demás', async () => {
    const c = catastroFalso({
      radio: ok([parcela('P1', 1), parcela('P2', 2), parcela('P3', 3)]),
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

  it('fallan todas las del WFS → pasada de ~25 m', async () => {
    const c = catastroFalso({
      radio: ok([parcela('P1', 1), parcela('P2', 2)]),
      coordenadas: ok([parcela('C1', 1)]),
      referencia: (pc) => (pc === 'C1' ? ok([BUENO]) : err({ tipo: 'red', mensaje: 'x' })),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(c.ops()).toEqual(['radio', 'referencia', 'referencia', 'coordenadas', 'referencia'])
    expect(r.ok && r.valor.candidatos.map((x) => x.inmueble.rc)).toEqual(['BUENO'])
  })

  it('fallan todas y la pasada de ~25 m no da nada → error', async () => {
    const c = catastroFalso({
      radio: ok([parcela('P1', 1), parcela('P2', 2)]),
      referencia: (pc) => (pc === 'P1' ? vacio : err({ tipo: 'red', mensaje: 'x' })),
    })
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(r).toEqual(err({ tipo: 'red', mensaje: 'x' }))
  })

  it(`DNPRC con como mucho ${CONCURRENCIA_DNPRC} a la vez`, async () => {
    let activas = 0
    let maximo = 0
    const c = catastroFalso({
      radio: ok(Array.from({ length: 20 }, (_, i) => parcela(`P${i}`, i))),
    })
    c.catastro.buscarPorReferencia = async () => {
      maximo = Math.max(maximo, ++activas)
      await new Promise((r) => setTimeout(r, 1))
      activas--
      return ok([BUENO])
    }
    const r = await emparejar(soloCoords, deps(c.catastro))
    expect(maximo).toBe(CONCURRENCIA_DNPRC)
    expect(r.ok && r.valor.candidatos).toHaveLength(20)
  })

  it('la señal llega al Catastro; abortada, no degrada ni sigue', async () => {
    const ctrl = new AbortController()
    const c = catastroFalso({ radio: ok([parcela('P1', 1), parcela('P2', 2)]) })
    const vistas: (AbortSignal | undefined)[] = []
    const radio = c.catastro.parcelasEnRadio
    c.catastro.parcelasEnRadio = (co, m, p, s) => {
      vistas.push(s)
      return radio(co, m, p, s)
    }
    c.catastro.buscarPorReferencia = async (_, s) => {
      vistas.push(s)
      ctrl.abort()
      return err({ tipo: 'red', mensaje: 'abortado' })
    }
    const r = await emparejar(soloCoords, deps(c.catastro), ctrl.signal)
    expect(vistas).toEqual([ctrl.signal, ctrl.signal])
    expect(c.ops()).toEqual(['radio'])
    expect(r.ok).toBe(false)
  })

  it('todas sin inmuebles → ninguna', async () => {
    const c = catastroFalso({ radio: ok([parcela('P1', 1)]) })
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
    const c = catastroFalso({
      radio: err({ tipo: 'noSoportado' }),
      coordenadas: err({ tipo: 'noSoportado' }),
    })
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
