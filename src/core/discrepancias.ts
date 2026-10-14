import { cuadraConAnexo, USO_ANEXO } from './anexos'
import { normalizarPlanta } from './planta'
import type { Anuncio, Confianza, Discrepancia, Inmueble, TipoInmueble } from './tipos'

const VIVIENDA: TipoInmueble[] = ['piso', 'atico', 'duplex', 'estudio', 'casa']
const m2 = (n: number) => `${n} m²`
const SUMA_ANEXO =
  'El anuncio puede estar sumando el garaje/trastero, que en el Catastro es un inmueble aparte. Pide la superficie de la vivienda sola y comprueba que el anexo entra en la venta.'

export function discrepancias(
  anuncio: Anuncio,
  inmueble: Inmueble,
  confianza: Confianza,
  parcela: Inmueble[],
): Discrepancia[] {
  const sup = superficie(anuncio, inmueble, parcela)
  const r = [
    sup,
    anio(anuncio, inmueble),
    uso(anuncio, inmueble),
    planta(anuncio, inmueble),
    // Ya lo dice la superficie.
    sup?.explicacion === SUMA_ANEXO ? undefined : anexo(anuncio, inmueble, parcela),
  ].filter((d): d is Discrepancia => d !== undefined)
  const pocoFiable = confianza === 'baja' || confianza === 'ninguna'
  return pocoFiable ? r.map((d) => ({ ...d, pocoFiable })) : r
}

function superficie(a: Anuncio, i: Inmueble, parcela: Inmueble[]): Discrepancia | undefined {
  if (!i.m2) return
  const catastro = m2(i.m2)
  if (a.m2Construidos) {
    // Enteros: evita errores de coma flotante en los bordes del 10 y 20 %.
    const dif = Math.abs(a.m2Construidos - i.m2)
    const anuncio = m2(a.m2Construidos)
    if (dif * 10 <= i.m2)
      return {
        campo: 'superficie',
        nivel: 'ok',
        anuncio,
        catastro,
        explicacion:
          'El Catastro incluye zonas comunes; diferencias de hasta un 10 % son normales.',
      }
    // El anexo debe cubrir al menos lo que pasa del 10 %.
    if (cuadraConAnexo(a, a.m2Construidos, i, parcela, a.m2Construidos - i.m2 * 1.1))
      return { campo: 'superficie', nivel: 'revisar', anuncio, catastro, explicacion: SUMA_ANEXO }
    if (dif * 5 <= i.m2)
      return {
        campo: 'superficie',
        nivel: 'revisar',
        anuncio,
        catastro,
        explicacion:
          'La superficie difiere del Catastro más de lo habitual. Pide que te la aclaren.',
      }
    return {
      campo: 'superficie',
      nivel: 'aviso',
      anuncio,
      catastro,
      explicacion:
        'La superficie difiere del Catastro más de un 20 %. Puede haber ampliaciones sin registrar o un error en el anuncio: pide la nota simple.',
    }
  }
  if (a.m2Utiles) {
    const ok = a.m2Utiles <= i.m2 && a.m2Utiles * 10 >= i.m2 * 7
    return {
      campo: 'superficie',
      nivel: ok ? 'ok' : 'revisar',
      anuncio: `${m2(a.m2Utiles)} útiles`,
      catastro,
      explicacion: ok
        ? 'La útil suele ser algo menor que la del Catastro, que incluye muros y zonas comunes.'
        : 'La superficie útil no cuadra con la del Catastro. Pide que te la aclaren.',
    }
  }
}

function anio(a: Anuncio, i: Inmueble): Discrepancia | undefined {
  if (!a.anio || !i.anio) return
  const ok = Math.abs(a.anio - i.anio) <= 2
  return {
    campo: 'anio',
    nivel: ok ? 'ok' : 'revisar',
    anuncio: String(a.anio),
    catastro: String(i.anio),
    explicacion: ok
      ? 'El año coincide con el Catastro.'
      : 'El año no coincide con el Catastro. Puede ser una reforma; pregunta.',
  }
}

function uso(a: Anuncio, i: Inmueble): Discrepancia | undefined {
  if (!a.tipo || !i.uso) return
  if (/^residencial/i.test(i.uso))
    return {
      campo: 'uso',
      nivel: 'ok',
      catastro: i.uso,
      explicacion: 'Consta como vivienda en el Catastro.',
    }
  if (VIVIENDA.includes(a.tipo))
    return {
      campo: 'uso',
      nivel: 'aviso',
      anuncio: 'Vivienda',
      catastro: i.uso,
      explicacion:
        'No consta como vivienda en el Catastro. Puede no tener cédula de habitabilidad.',
    }
}

function planta(a: Anuncio, i: Inmueble): Discrepancia | undefined {
  const p = normalizarPlanta(a.planta)
  if (!p || p === 'otro' || !i.planta) return
  const ok = p === normalizarPlanta(i.planta)
  return {
    campo: 'planta',
    nivel: ok ? 'ok' : 'revisar',
    anuncio: a.planta,
    catastro: i.planta,
    explicacion: ok
      ? 'La planta coincide con el Catastro.'
      : 'La planta no coincide. Comprueba que es el inmueble correcto.',
  }
}

function anexo(a: Anuncio, i: Inmueble, parcela: Inmueble[]): Discrepancia | undefined {
  if (!a.mencionaTrastero && !a.mencionaGaraje) return
  const hay = parcela.some((p) => p.rc !== i.rc && USO_ANEXO.test(p.uso))
  if (!hay) return
  const que = [a.mencionaTrastero && 'el trastero', a.mencionaGaraje && 'el garaje']
    .filter(Boolean)
    .join(' y ')
  const verbo = a.mencionaTrastero && a.mencionaGaraje ? 'entran' : 'entra'
  return {
    campo: 'anexo',
    nivel: 'revisar',
    anuncio: que.replace(/el /g, ''),
    explicacion: `En el edificio hay trasteros o garajes con referencia catastral propia. Comprueba que ${que} ${verbo} en la venta.`,
  }
}
