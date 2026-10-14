import impuestos from '../../data/impuestos.json'
import { crearClienteCatastro } from '../adapters/catastro/cliente'
import { crearAlmacen, crearSesion } from '../adapters/navegador/almacenes'
import type { TablaImpuestos } from '../core/gastos'
import { crearControlador } from '../core/panel/controlador'
import { validarMensaje, type MensajeAlPanel } from '../core/panel/mensajes'

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

  const control = crearControlador({
    catastro: crearClienteCatastro(fetch.bind(globalThis)),
    almacen: crearAlmacen(browser.storage.local),
    sesion: crearSesion(browser.storage.session),
    impuestos: impuestos as TablaImpuestos,
    emitir(tab, estado) {
      const m: MensajeAlPanel = { tipo: 'estado', tab, estado }
      // Sin panel abierto no hay receptor.
      browser.runtime.sendMessage(m).catch(() => {})
    },
  })

  // Nueva carga de la pestaña: el content script volverá a enviar el anuncio si lo hay.
  browser.tabs.onUpdated.addListener((tab, cambio) => {
    if (cambio.status === 'loading') void control.olvidar(tab)
  })
  browser.tabs.onRemoved.addListener((tab) => void control.olvidar(tab))

  const urlPanel = browser.runtime.getURL('/sidepanel.html')

  browser.runtime.onMessage.addListener((bruto: unknown, remitente, responder) => {
    const tab = remitente.tab?.id
    const m = validarMensaje(bruto, { tab, url: remitente.url }, urlPanel)
    if (!m) return false
    const respuesta = (() => {
      switch (m.tipo) {
        case 'anuncio':
          // validarMensaje garantiza la pestaña.
          return control.recibirAnuncio(tab ?? -1, m.anuncio)
        case 'pedirEstado':
          return control.estado(m.tab)
        case 'confirmar':
          return control.confirmar(m.tab, m.rc)
        case 'buscarNumeros':
          return control.buscarNumeros(m.tab, m.via, m.numero)
        case 'inmueblesParcela':
          return control.inmueblesParcela(m.tab, m.pc)
      }
    })()
    respuesta.then(responder, (e) => {
      console.error(e)
      responder(undefined)
    })
    return true
  })
})
