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

/** La pestaña no tiene anuncio ni en memoria ni en sesión. */
export const SIN_ANUNCIO = { ok: false, error: { tipo: 'sinAnuncio' } } as const

export type RespuestaAccion<T> = Resultado<T> | typeof SIN_ANUNCIO

export type ResultadoConfirmar = 'ok' | 'rcInvalida' | 'sinAnuncio'

const NO_SOPORTADO: EstadoPanel = { tipo: 'noSoportado' }

export function crearControlador(deps: DepsControlador) {
  const estados = new Map<number, EstadoPanel>()
  const anuncios = new Map<number, Anuncio>()
  const enCurso = new Map<number, { id: string; promesa: Promise<void> }>()
  // Cada análisis o `olvidar` invalida los anteriores de la pestaña.
  const versiones = new Map<number, number>()
  const cancelar = new Map<number, AbortController>()

  const fijar = (tab: number, estado: EstadoPanel) => {
    estados.set(tab, estado)
    deps.emitir(tab, estado)
  }

  const nuevaVersion = (tab: number) => {
    cancelar.get(tab)?.abort()
    cancelar.delete(tab)
    const v = (versiones.get(tab) ?? 0) + 1
    versiones.set(tab, v)
    return v
  }

  /** `forzar`: rehace aunque haya uno en curso del mismo anuncio (p. ej. tras confirmar). */
  function analizarTab(tab: number, anuncio: Anuncio, forzar = false): Promise<void> {
    const actual = enCurso.get(tab)
    if (actual && !forzar && actual.id === anuncio.id) return actual.promesa
    const v = nuevaVersion(tab)
    anuncios.set(tab, anuncio)
    fijar(tab, { tipo: 'cargando' })
    const ctrl = new AbortController()
    cancelar.set(tab, ctrl)
    const promesa = analizar(anuncio, deps, ctrl.signal).then((analisis) => {
      if (versiones.get(tab) === v) fijar(tab, { tipo: 'analisis', analisis })
    })
    enCurso.set(tab, { id: anuncio.id, promesa })
    void promesa.finally(() => {
      if (enCurso.get(tab)?.promesa === promesa) enCurso.delete(tab)
    })
    return promesa
  }

  async function anuncioDe(tab: number): Promise<Anuncio | undefined> {
    return anuncios.get(tab) ?? (await deps.sesion.leer(tab))
  }

  return {
    async recibirAnuncio(tab: number, anuncio: Anuncio | null) {
      if (!anuncio) return this.olvidar(tab)
      await deps.sesion.guardar(tab, anuncio)
      await analizarTab(tab, anuncio)
    },

    async olvidar(tab: number) {
      nuevaVersion(tab)
      anuncios.delete(tab)
      enCurso.delete(tab)
      await deps.sesion.borrar(tab)
      fijar(tab, NO_SOPORTADO)
    },

    async estado(tab: number): Promise<EstadoPanel> {
      const e = estados.get(tab)
      if (e) return e
      const anuncio = await deps.sesion.leer(tab)
      if (!anuncio) return NO_SOPORTADO
      void analizarTab(tab, anuncio)
      return { tipo: 'cargando' }
    },

    /** Espera a los análisis en curso. */
    async inactivo() {
      await Promise.all([...enCurso.values()].map((x) => x.promesa))
    },

    async confirmar(tab: number, rc: string): Promise<ResultadoConfirmar> {
      const anuncio = await anuncioDe(tab)
      if (!anuncio) return 'sinAnuncio'
      if (!(await guardarSeleccion(deps.almacen, anuncio.id, rc))) return 'rcInvalida'
      await analizarTab(tab, anuncio, true)
      return 'ok'
    },

    async buscarNumeros(
      tab: number,
      via: string,
      numero: string,
    ): Promise<RespuestaAccion<NumeroVia[]>> {
      const anuncio = await anuncioDe(tab)
      if (!anuncio) return SIN_ANUNCIO
      const { provincia, municipio } = anuncio
      if (!provincia || !municipio)
        return {
          ok: false,
          error: { tipo: 'sinResultados', mensaje: 'Faltan provincia o municipio' },
        }
      return deps.catastro.buscarNumeros({
        provincia,
        municipio,
        numero: numero.trim(),
        ...separarVia(via),
      })
    },

    async inmueblesParcela(tab: number, pc: string): Promise<RespuestaAccion<Candidato[]>> {
      const anuncio = await anuncioDe(tab)
      if (!anuncio) return SIN_ANUNCIO
      const r = await deps.catastro.buscarPorReferencia(pc)
      return r.ok ? { ok: true, valor: ordenarCandidatos(anuncio, r.valor) } : r
    },
  }
}

export type Controlador = ReturnType<typeof crearControlador>
