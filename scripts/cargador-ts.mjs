// Node ≥ 23.6 ejecuta .ts quitando tipos, pero no resuelve imports sin extensión: se añade `.ts`.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(especificador, contexto, siguiente) {
    try {
      return siguiente(especificador, contexto)
    } catch (e) {
      if (!especificador.startsWith('.')) throw e
      return siguiente(`${especificador}.ts`, contexto)
    }
  },
})
