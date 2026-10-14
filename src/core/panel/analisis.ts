import { detectarAlertas } from '../alertas'
import { discrepancias } from '../discrepancias'
import { emparejar, type DepsEmparejamiento } from '../emparejamiento/flujo'
import type { ErrorCatastro } from '../emparejamiento/puertos'
import { calcularGastos, type TablaImpuestos } from '../gastos'
import type { Alerta, Anuncio, Discrepancia, Emparejamiento, Gastos, Inmueble } from '../tipos'

export interface Analisis {
  anuncio: Anuncio
  /** Ausente si el Catastro falló (`error`). */
  emparejamiento?: Emparejamiento
  error?: ErrorCatastro
  /** Contra el primer candidato. */
  discrepancias: Discrepancia[]
  alertas: Alerta[]
  gastos: Gastos | null
}

export interface DepsAnalisis extends DepsEmparejamiento {
  impuestos: TablaImpuestos
}

export async function analizar(
  anuncio: Anuncio,
  deps: DepsAnalisis,
  signal?: AbortSignal,
): Promise<Analisis> {
  const base = {
    anuncio,
    discrepancias: [],
    alertas: detectarAlertas(anuncio.descripcion),
    gastos: calcularGastos(anuncio, deps.impuestos),
  }
  const r = await emparejar(anuncio, deps, signal)
  if (!r.ok) return { ...base, error: r.error }

  const e = r.valor
  const elegido = e.candidatos[0]?.inmueble
  if (!elegido) return { ...base, emparejamiento: e }

  const parcela =
    e.origen === 'manual'
      ? await inmueblesParcela(elegido, deps, signal)
      : e.candidatos.map((c) => c.inmueble)
  return {
    ...base,
    emparejamiento: e,
    discrepancias: discrepancias(anuncio, elegido, e.confianza, parcela),
  }
}

// La RC confirmada trae un solo inmueble; los anexos están en el resto de la parcela.
async function inmueblesParcela(
  i: Inmueble,
  { catastro }: DepsAnalisis,
  signal?: AbortSignal,
): Promise<Inmueble[]> {
  const r = await catastro.buscarPorReferencia(i.rc.slice(0, 14), signal)
  return r.ok ? r.valor : [i]
}
