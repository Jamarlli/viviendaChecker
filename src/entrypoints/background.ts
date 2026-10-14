import impuestos from '../../data/impuestos.json'
import { crearClienteCatastro } from '../adapters/catastro/cliente'
import { crearAlmacen, crearSesion } from '../adapters/navegador/almacenes'
import type { TablaImpuestos } from '../core/gastos'
import { crearControlador } from '../core/panel/controlador'
import type { MensajeAlFondo, MensajeAlPanel } from '../core/panel/mensajes'

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

  browser.runtime.onMessage.addListener((m: MensajeAlFondo, remitente, responder) => {
    const tab = remitente.tab?.id
    const respuesta = (() => {
      switch (m.tipo) {
        case 'anuncio':
          return tab === undefined ? undefined : control.recibirAnuncio(tab, m.anuncio)
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
    if (!respuesta) return false
    respuesta.then(responder, (e) => {
      console.error(e)
      responder(undefined)
    })
    return true
  })
})
