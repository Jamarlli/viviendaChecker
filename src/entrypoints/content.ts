import { extraerAnuncio } from '../adapters/portales/idealista/extraer'
import type { MensajeAlFondo } from '../core/panel/mensajes'

export default defineContentScript({
  matches: ['https://www.idealista.com/inmueble/*', 'https://www.idealista.com/*/inmueble/*'],
  main() {
    const m: MensajeAlFondo = { tipo: 'anuncio', anuncio: extraerAnuncio(document, location.href) }
    browser.runtime.sendMessage(m).catch(console.error)
  },
})
