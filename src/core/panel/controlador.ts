import { guardarSeleccion } from '../emparejamiento/flujo'
import type { NumeroVia, Resultado } from '../emparejamiento/puertos'
import { ordenarCandidatos } from '../emparejamiento/puntuacion'
import { separarVia } from '../emparejamiento/via'
import type { Anuncio, Candidato } from '../tipos'
import { analizar, type Analisis, type DepsAnalisis } from './analisis'

export type EstadoPanel =
  { tipo: 'noSoportado' } | { tipo: 'cargando' } | { tipo: 'analisis'; analisis: Analisis }

/** Último anuncio por pestaña; sobrevive al reinicio del service worker. */
export interface Sesion {
  leer(tab: number): Promise<Anuncio | undefined>
  guardar(tab: number, anuncio: Anuncio): Promise<void>
  borrar(tab: number): Promise<void>
}

export interface DepsControlador extends DepsAnalisis {
  sesion: Sesion
  emitir(tab: number, estado: EstadoPanel): void
}

const NO_SOPORTADO: EstadoPanel = { tipo: 'noSoportado' }
const sinDatos: Resultado<never> = {
  ok: false,
  error: { tipo: 'sinResultados', mensaje: 'Faltan provincia o municipio' },
}

export function crearControlador(deps: DepsControlador) {
  const estados = new Map<number, EstadoPanel>()
  const anuncios = new Map<number, Anuncio>()
  const pendientes = new Set<Promise<void>>()

  const fijar = (tab: number, estado: EstadoPanel) => {
    estados.set(tab, estado)
    deps.emitir(tab, estado)
  }

  async function analizarTab(tab: number, anuncio: Anuncio) {
    anuncios.set(tab, anuncio)
    fijar(tab, { tipo: 'cargando' })
    const analisis = await analizar(anuncio, deps)
    // Otro anuncio llegó a la pestaña mientras tanto.
    if (anuncios.get(tab) !== anuncio) return
    fijar(tab, { tipo: 'analisis', analisis })
  }

  function enSegundoPlano(p: Promise<void>) {
    pendientes.add(p)
    p.finally(() => pendientes.delete(p))
  }

  return {
    async recibirAnuncio(tab: number, anuncio: Anuncio | null) {
      if (!anuncio) return this.olvidar(tab)
      await deps.sesion.guardar(tab, anuncio)
      await analizarTab(tab, anuncio)
    },

    async olvidar(tab: number) {
      anuncios.delete(tab)
      await deps.sesion.borrar(tab)
      fijar(tab, NO_SOPORTADO)
    },

    async estado(tab: number): Promise<EstadoPanel> {
      const e = estados.get(tab)
      if (e) return e
      const anuncio = await deps.sesion.leer(tab)
      if (!anuncio) return NO_SOPORTADO
      enSegundoPlano(analizarTab(tab, anuncio))
      return { tipo: 'cargando' }
    },

    /** Para tests: espera a los análisis en curso. */
    async inactivo() {
      await Promise.all(pendientes)
    },

    async confirmar(tab: number, rc: string): Promise<boolean> {
      const anuncio = anuncios.get(tab)
      if (!anuncio || !(await guardarSeleccion(deps.almacen, anuncio.id, rc))) return false
      await analizarTab(tab, anuncio)
      return true
    },

    async buscarNumeros(tab: number, via: string, numero: string): Promise<Resultado<NumeroVia[]>> {
      const { provincia, municipio } = anuncios.get(tab) ?? {}
      if (!provincia || !municipio) return sinDatos
      return deps.catastro.buscarNumeros({
        provincia,
        municipio,
        numero: numero.trim(),
        ...separarVia(via),
      })
    },

    async inmueblesParcela(tab: number, pc: string): Promise<Resultado<Candidato[]>> {
      const anuncio = anuncios.get(tab)
      if (!anuncio) return sinDatos
      const r = await deps.catastro.buscarPorReferencia(pc)
      return r.ok ? { ok: true, valor: ordenarCandidatos(anuncio, r.valor) } : r
    },
  }
}

export type Controlador = ReturnType<typeof crearControlador>
