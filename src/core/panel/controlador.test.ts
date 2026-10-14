import { describe, expect, it } from 'vitest'
import type { Resultado } from '../emparejamiento/puertos'
import type { Inmueble } from '../tipos'
import { crearControlador, type EstadoPanel } from './controlador'
import {
  almacenFalso,
  anuncio,
  catastroFalso,
  impuestos,
  inmueble,
  sesionFalsa,
  type Respuestas,
} from './falsos'

const RC = '1111111VK1111A0001AA'
const BUENO = inmueble(RC)

function montar(r: Respuestas = {}, sesionInicial = {}) {
  const f = catastroFalso(r)
  const { almacen, datos: guardado } = almacenFalso()
  const { sesion, datos: enSesion } = sesionFalsa(sesionInicial)
  const emitidos: { tab: number; estado: EstadoPanel }[] = []
  const c = crearControlador({
    catastro: f.catastro,
    almacen,
    impuestos,
    sesion,
    emitir: (tab, estado) => emitidos.push({ tab, estado }),
  })
  const tipos = () => emitidos.map((e) => e.estado.tipo)
  return { c, f, guardado, enSesion, emitidos, tipos }
}

const conBueno = { direccion: { ok: true, valor: [BUENO] } as Resultado<Inmueble[]> }

describe('controlador del panel', () => {
  it('sin anuncio → noSoportado', async () => {
    const m = montar()
    await m.c.recibirAnuncio(1, null)
    expect(m.tipos()).toEqual(['noSoportado'])
    expect(await m.c.estado(1)).toEqual({ tipo: 'noSoportado' })
  })

  it('anuncio → cargando y luego análisis; lo guarda en sesión', async () => {
    const m = montar(conBueno)
    await m.c.recibirAnuncio(1, anuncio())
    expect(m.tipos()).toEqual(['cargando', 'analisis'])
    expect(m.enSesion.get(1)?.id).toBe('42')
    const e = await m.c.estado(1)
    expect(e.tipo === 'analisis' && e.analisis.emparejamiento?.candidatos[0]?.inmueble.rc).toBe(RC)
  })

  it('pestaña desconocida → noSoportado', async () => {
    expect(await montar().c.estado(7)).toEqual({ tipo: 'noSoportado' })
  })

  it('tras reiniciar, rehace el análisis desde la sesión', async () => {
    const m = montar(conBueno, { 3: anuncio() })
    expect(await m.c.estado(3)).toEqual({ tipo: 'cargando' })
    await m.c.inactivo()
    expect(m.tipos()).toEqual(['cargando', 'analisis'])
  })

  it('olvidar → noSoportado y borra la sesión', async () => {
    const m = montar(conBueno)
    await m.c.recibirAnuncio(1, anuncio())
    await m.c.olvidar(1)
    expect(m.enSesion.has(1)).toBe(false)
    expect(await m.c.estado(1)).toEqual({ tipo: 'noSoportado' })
  })

  it('un análisis antiguo no pisa el anuncio nuevo', async () => {
    const m = montar(conBueno)
    const viejo = m.c.recibirAnuncio(1, anuncio({ id: 'viejo' }))
    await m.c.recibirAnuncio(1, anuncio({ id: 'nuevo' }))
    await viejo
    const e = await m.c.estado(1)
    expect(e.tipo === 'analisis' && e.analisis.anuncio.id).toBe('nuevo')
  })

  it('confirmar guarda la RC y reanaliza como manual', async () => {
    const m = montar({ ...conBueno, referencia: () => ({ ok: true, valor: [BUENO] }) })
    await m.c.recibirAnuncio(1, anuncio())
    expect(await m.c.confirmar(1, RC.toLowerCase())).toBe('ok')
    expect(m.guardado['42']).toEqual({ rc: RC })
    const e = await m.c.estado(1)
    expect(e.tipo === 'analisis' && e.analisis.emparejamiento?.origen).toBe('manual')
  })

  it('confirmar RC no válida → rcInvalida, no guarda', async () => {
    const m = montar(conBueno)
    await m.c.recibirAnuncio(1, anuncio())
    expect(await m.c.confirmar(1, '123')).toBe('rcInvalida')
    expect(m.guardado).toEqual({})
  })

  it('confirmar sin anuncio conocido → sinAnuncio', async () => {
    expect(await montar().c.confirmar(9, RC)).toBe('sinAnuncio')
  })

  it('buscarNumeros usa provincia y municipio del anuncio', async () => {
    const m = montar({ numeros: { ok: true, valor: [{ numero: '5', pc: '1111111VK1111A' }] } })
    await m.c.recibirAnuncio(1, anuncio())
    const r = await m.c.buscarNumeros(1, 'Avenida de América', '5')
    expect(r).toEqual({ ok: true, valor: [{ numero: '5', pc: '1111111VK1111A' }] })
    expect(m.f.llamadas.find((l) => l.op === 'numeros')?.arg).toEqual({
      provincia: 'Madrid',
      municipio: 'Madrid',
      sigla: 'AV',
      calle: 'AMERICA',
      numero: '5',
    })
  })

  it('buscarNumeros sin provincia o municipio → sinResultados', async () => {
    const m = montar()
    await m.c.recibirAnuncio(1, anuncio({ municipio: undefined }))
    const r = await m.c.buscarNumeros(1, 'Calle Mayor', '1')
    expect(r).toMatchObject({ ok: false, error: { tipo: 'sinResultados' } })
  })

  it('inmueblesParcela devuelve candidatos ordenados', async () => {
    const malo = inmueble('1111111VK1111A0009ZZ', { m2: 40, planta: '05', uso: 'Comercial' })
    const m = montar({ referencia: () => ({ ok: true, valor: [malo, BUENO] }) })
    await m.c.recibirAnuncio(1, anuncio())
    const r = await m.c.inmueblesParcela(1, '1111111VK1111A')
    expect(r.ok && r.valor.map((c) => c.inmueble.rc)).toEqual([RC, malo.rc])
  })

  describe('con el service worker recién despertado (solo sesión)', () => {
    const SESION = { 1: anuncio() }

    it('confirmar recupera el anuncio de la sesión', async () => {
      const m = montar({ referencia: () => ({ ok: true, valor: [BUENO] }) }, SESION)
      expect(await m.c.confirmar(1, RC)).toBe('ok')
      expect(m.guardado['42']).toEqual({ rc: RC })
      const e = await m.c.estado(1)
      expect(e.tipo === 'analisis' && e.analisis.emparejamiento?.origen).toBe('manual')
    })

    it('buscarNumeros recupera el anuncio de la sesión', async () => {
      const m = montar({ numeros: { ok: true, valor: [] } }, SESION)
      await m.c.buscarNumeros(1, 'Calle Mayor', '1')
      expect(m.f.llamadas.find((l) => l.op === 'numeros')?.arg).toMatchObject({
        provincia: 'Madrid',
        municipio: 'Madrid',
      })
    })

    it('inmueblesParcela recupera el anuncio de la sesión', async () => {
      const m = montar({ referencia: () => ({ ok: true, valor: [BUENO] }) }, SESION)
      const r = await m.c.inmueblesParcela(1, '1111111VK1111A')
      expect(r.ok && r.valor.map((c) => c.inmueble.rc)).toEqual([RC])
    })

    it('sin anuncio en sesión → sinAnuncio', async () => {
      const m = montar()
      expect(await m.c.buscarNumeros(1, 'Calle Mayor', '1')).toEqual({
        ok: false,
        error: { tipo: 'sinAnuncio' },
      })
      expect(await m.c.inmueblesParcela(1, 'X')).toEqual({
        ok: false,
        error: { tipo: 'sinAnuncio' },
      })
    })
  })

  it('análisis concurrentes de la misma pestaña se deduplican', async () => {
    const m = montar(conBueno, { 3: anuncio() })
    await Promise.all([m.c.estado(3), m.c.estado(3)])
    await Promise.all([m.c.recibirAnuncio(3, anuncio()), m.c.recibirAnuncio(3, anuncio())])
    await m.c.inactivo()
    expect(m.f.llamadas.filter((l) => l.op === 'direccion')).toHaveLength(1)
  })
})
