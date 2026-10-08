import type { Anuncio, Confianza, Discrepancia, Inmueble, TipoInmueble } from './tipos'

const VIVIENDA: TipoInmueble[] = ['piso', 'atico', 'duplex', 'estudio', 'casa']
const m2 = (n: number) => `${n} m²`

export function discrepancias(
  anuncio: Anuncio,
  inmueble: Inmueble,
  confianza: Confianza,
  parcela: Inmueble[],
): Discrepancia[] {
  const r = [
    superficie(anuncio, inmueble),
    anio(anuncio, inmueble),
    uso(anuncio, inmueble),
    planta(anuncio, inmueble),
    anexo(anuncio, inmueble, parcela),
  ].filter((d): d is Discrepancia => d !== undefined)
  const pocoFiable = confianza === 'baja' || confianza === 'ninguna'
  return pocoFiable ? r.map((d) => ({ ...d, pocoFiable })) : r
}

function superficie(a: Anuncio, i: Inmueble): Discrepancia | undefined {
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
    return {
      campo: 'superficie',
      nivel: dif * 5 <= i.m2 ? 'revisar' : 'aviso',
      anuncio,
      catastro,
      explicacion: 'La superficie difiere del Catastro más de lo habitual. Pide que te la aclaren.',
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
  if (!a.planta || !i.planta) return
  const ok = normalizarPlanta(a.planta) === normalizarPlanta(i.planta)
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

// Mínima; se unificará con la de emparejamiento (#8).
function normalizarPlanta(p: string): string {
  const s = p.trim().toLowerCase()
  if (['bj', 'bajo', 'baja'].includes(s)) return '0'
  return /^-?\d+$/.test(s) ? String(Number(s)) : s
}

function anexo(a: Anuncio, i: Inmueble, parcela: Inmueble[]): Discrepancia | undefined {
  if (!a.mencionaTrastero && !a.mencionaGaraje) return
  const hay = parcela.some((p) => p.rc !== i.rc && /almac|estacion|aparca/i.test(p.uso))
  if (!hay) return
  const que = [a.mencionaTrastero && 'trastero', a.mencionaGaraje && 'garaje']
    .filter(Boolean)
    .join(' y ')
  return {
    campo: 'anexo',
    nivel: 'revisar',
    anuncio: que,
    explicacion: `En el edificio hay trasteros o garajes con referencia catastral propia. Comprueba que el ${que} entra en la venta.`,
  }
}
