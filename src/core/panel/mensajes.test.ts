import { describe, expect, it } from 'vitest'
import { anuncio } from './falsos'
import { validarMensaje } from './mensajes'

const PANEL = 'chrome-extension://abc/sidepanel.html'
const panel = { url: PANEL }
const pagina = { tab: 4, url: 'https://www.idealista.com/inmueble/42/' }

describe('validarMensaje', () => {
  it('anuncio desde el content script de una pestaña', () => {
    const m = { tipo: 'anuncio', anuncio: anuncio() }
    expect(validarMensaje(m, pagina, PANEL)).toEqual(m)
    expect(validarMensaje({ tipo: 'anuncio', anuncio: null }, pagina, PANEL)).not.toBeNull()
  })

  it('anuncio sin pestaña o desde el panel → null', () => {
    const m = { tipo: 'anuncio', anuncio: null }
    expect(validarMensaje(m, { url: pagina.url }, PANEL)).toBeNull()
    expect(validarMensaje(m, { ...panel, tab: 1 }, PANEL)).toBeNull()
  })

  it('anuncio mal formado → null', () => {
    expect(validarMensaje({ tipo: 'anuncio', anuncio: { id: 1 } }, pagina, PANEL)).toBeNull()
    expect(validarMensaje({ tipo: 'anuncio' }, pagina, PANEL)).toBeNull()
  })

  it('acciones del panel', () => {
    const ms = [
      { tipo: 'pedirEstado', tab: 1 },
      { tipo: 'confirmar', tab: 1, rc: 'X' },
      { tipo: 'buscarNumeros', tab: 1, via: 'Calle Mayor', numero: '1' },
      { tipo: 'inmueblesParcela', tab: 1, pc: 'X' },
    ]
    for (const m of ms) expect(validarMensaje(m, panel, PANEL)).toEqual(m)
    expect(validarMensaje(ms[0], { url: `${PANEL}#x` }, PANEL)).toEqual(ms[0])
  })

  it('acciones desde una página web → null', () => {
    expect(validarMensaje({ tipo: 'confirmar', tab: 1, rc: 'X' }, pagina, PANEL)).toBeNull()
    expect(validarMensaje({ tipo: 'pedirEstado', tab: 1 }, {}, PANEL)).toBeNull()
  })

  it('campos de tipo o tamaño incorrecto → null', () => {
    expect(validarMensaje({ tipo: 'pedirEstado', tab: '1' }, panel, PANEL)).toBeNull()
    expect(validarMensaje({ tipo: 'pedirEstado', tab: -1 }, panel, PANEL)).toBeNull()
    expect(validarMensaje({ tipo: 'confirmar', tab: 1, rc: 5 }, panel, PANEL)).toBeNull()
    expect(
      validarMensaje({ tipo: 'inmueblesParcela', tab: 1, pc: 'X'.repeat(500) }, panel, PANEL),
    ).toBeNull()
    expect(validarMensaje({ tipo: 'otro', tab: 1 }, panel, PANEL)).toBeNull()
    expect(validarMensaje('hola', panel, PANEL)).toBeNull()
  })
})
