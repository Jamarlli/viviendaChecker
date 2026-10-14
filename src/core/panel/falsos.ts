// Dobles para tests del panel.
import type {
  Almacen,
  ClienteCatastro,
  NumeroVia,
  Parcela,
  Resultado,
  SeleccionManual,
} from '../emparejamiento/puertos'
import type { TablaImpuestos } from '../gastos'
import type { Anuncio, Inmueble } from '../tipos'
import type { Sesion } from './controlador'

export const vacio: Resultado<never> = {
  ok: false,
  error: { tipo: 'sinResultados', mensaje: '' },
}

export const inmueble = (rc: string, datos: Partial<Inmueble> = {}): Inmueble => ({
  rc,
  uso: 'Residencial',
  m2: 100,
  anio: 2000,
  planta: '01',
  puerta: 'A',
  direccion: 'CL MAYOR 1, MADRID',
  ...datos,
})

export const anuncio = (datos: Partial<Anuncio> = {}): Anuncio => ({
  portal: 'idealista',
  id: '42',
  url: 'https://www.idealista.com/inmueble/42/',
  precio: 200000,
  provincia: 'Madrid',
  municipio: 'Madrid',
  direccion: { via: 'Calle Mayor', numero: '1' },
  obraNueva: false,
  descripcion: '',
  mencionaTrastero: false,
  mencionaGaraje: false,
  m2Construidos: 100,
  planta: '1',
  anio: 2000,
  ...datos,
})

export interface Respuestas {
  direccion?: Resultado<Inmueble[]>
  radio?: Resultado<Parcela[]>
  referencia?: (ref: string) => Resultado<Inmueble[]>
  numeros?: Resultado<NumeroVia[]>
}

export function catastroFalso(r: Respuestas = {}) {
  const llamadas: { op: string; arg: unknown; signal?: AbortSignal }[] = []
  const catastro: ClienteCatastro = {
    async buscarNumeros(l) {
      llamadas.push({ op: 'numeros', arg: l })
      return r.numeros ?? vacio
    },
    async buscarPorDireccion(l, signal) {
      llamadas.push({ op: 'direccion', arg: l, signal })
      return r.direccion ?? vacio
    },
    async parcelasEnRadio(c) {
      llamadas.push({ op: 'radio', arg: c })
      return r.radio ?? vacio
    },
    async buscarPorCoordenadas(c) {
      llamadas.push({ op: 'coordenadas', arg: c })
      return vacio
    },
    async buscarPorReferencia(ref) {
      llamadas.push({ op: 'referencia', arg: ref })
      return r.referencia?.(ref) ?? vacio
    },
  }
  return { catastro, llamadas }
}

export function almacenFalso(inicial: Record<string, SeleccionManual> = {}) {
  const datos = { ...inicial }
  const almacen: Almacen = {
    leer: async (id) => datos[id],
    guardar: async (id, s) => {
      datos[id] = s
    },
  }
  return { almacen, datos }
}

export function sesionFalsa(inicial: Record<number, Anuncio> = {}) {
  const datos = new Map(Object.entries(inicial).map(([k, v]) => [Number(k), v]))
  const sesion: Sesion = {
    leer: async (tab) => datos.get(tab),
    guardar: async (tab, a) => void datos.set(tab, a),
    borrar: async (tab) => void datos.delete(tab),
  }
  return { sesion, datos }
}

export const impuestos: TablaImpuestos = {
  comunidades: [
    {
      nombre: 'Madrid',
      provincias: [{ nombre: 'Madrid', variantes: [] }],
      itp: { modo: 'marginal', tramos: [{ desde: 0, tipo: 0.06 }] },
      ajd: 0.0075,
    },
  ],
  gastos: {
    notaria: { min: 600, max: 900 },
    registro: { min: 400, max: 600 },
    gestoria: { min: 300, max: 500 },
  },
}
