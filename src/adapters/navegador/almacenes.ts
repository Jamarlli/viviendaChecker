import type { Almacen, SeleccionManual } from '../../core/emparejamiento/puertos'
import type { Sesion } from '../../core/panel/controlador'
import type { Anuncio } from '../../core/tipos'

/** Subconjunto de `chrome.storage.StorageArea`. */
export interface Area {
  get(clave: string): Promise<Record<string, unknown>>
  set(datos: Record<string, unknown>): Promise<void>
  remove(clave: string): Promise<void>
}

/** Selección manual por id de anuncio (`storage.local`). */
export function crearAlmacen(area: Area): Almacen {
  const clave = (id: string) => `seleccion:${id}`
  return {
    async leer(id) {
      return (await area.get(clave(id)))[clave(id)] as SeleccionManual | undefined
    },
    guardar: (id, s) => area.set({ [clave(id)]: s }),
  }
}

/** Último anuncio por pestaña (`storage.session`). */
export function crearSesion(area: Area): Sesion {
  const clave = (tab: number) => `anuncio:${tab}`
  return {
    async leer(tab) {
      return (await area.get(clave(tab)))[clave(tab)] as Anuncio | undefined
    },
    guardar: (tab, a) => area.set({ [clave(tab)]: a }),
    borrar: (tab) => area.remove(clave(tab)),
  }
}
