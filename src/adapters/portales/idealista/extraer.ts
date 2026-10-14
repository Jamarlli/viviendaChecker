import { normalizarPlanta } from '../../../core/planta'
import type { Anuncio, TipoInmueble } from '../../../core/tipos'

// Sin APIs globales del navegador: funciona con el DOM del content script y con linkedom.

export function idDeUrl(url: string): string | undefined {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return undefined
  }
  if (!/(^|\.)idealista\.com$/.test(u.hostname)) return undefined
  return /^\/(?:[a-z]{2}\/)?inmueble\/(\d+)\/?$/.exec(u.pathname)?.[1]
}

const texto = (el: Element | null | undefined) => el?.textContent?.trim() ?? ''

/** Lista de `<li>` de cada sección de `.details-property`, por título. */
function secciones(doc: Document): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const h2 of doc.querySelectorAll('.details-property-h2')) {
    const lis = h2.nextElementSibling?.querySelectorAll('li') ?? []
    mapa.set(texto(h2), [...lis].map(texto))
  }
  return mapa
}

function numero(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'))
}

export function parsearSuperficies(lineas: string[]): {
  m2Construidos?: number
  m2Utiles?: number
} {
  const t = lineas.join('\n')
  const c = /([\d.]+)\s*m²\s*construidos/.exec(t)?.[1]
  const u = /([\d.]+)\s*m²\s*útiles/.exec(t)?.[1]
  return {
    ...(c && { m2Construidos: numero(c) }),
    ...(u && { m2Utiles: numero(u) }),
  }
}

export function parsearPlanta(t: string): string | undefined {
  const n = /(-?\d+)ª?\s*planta/i.exec(t)?.[1] ?? /planta\s*(-?\d+)/i.exec(t)?.[1]
  if (n) return normalizarPlanta(n)
  const p = /^\s*(bajo|entreplanta|semi-?s[oó]tano|s[oó]tano|[aá]tico)\b/i.exec(t)?.[1]
  return p ? normalizarPlanta(p.replace('-', '')) : undefined
}

const TIPOS: [RegExp, TipoInmueble][] = [
  [/^piso\b/i, 'piso'],
  [/^ático\b/i, 'atico'],
  [/^dúplex\b/i, 'duplex'],
  [/^estudio\b/i, 'estudio'],
  [/^(chalet|casa)\b/i, 'casa'],
]

export function parsearTipo(titulo: string): TipoInmueble | undefined {
  if (!titulo) return undefined
  return TIPOS.find(([re]) => re.test(titulo))?.[1] ?? 'otro'
}

export function parsearDireccion(t: string): { via?: string; numero?: string } {
  const m = /^(.+?),\s*(\d+\s*[A-Za-z]?)$/.exec(t)
  if (m) return { via: m[1], numero: m[2] }
  return { via: t.replace(/,\s*s\/n$/i, '') }
}

function ubicacion(doc: Document): Pick<Anuncio, 'direccion' | 'municipio' | 'provincia'> {
  const lis = [...doc.querySelectorAll('#headerMap li.header-map-list')].map(texto)
  const r: Pick<Anuncio, 'direccion' | 'municipio' | 'provincia'> = {}
  const primero = lis[0]
  if (lis.length >= 3 && primero && !/^(Barrio|Distrito) /.test(primero)) {
    r.direccion = parsearDireccion(primero)
  }
  if (lis.length >= 2) {
    r.municipio = lis.at(-2)
    r.provincia = lis.at(-1)?.split(',').at(-1)?.trim()
  }
  return r
}

/** El `var config` de la página no se puede ejecutar desde el content script: se lee con regex. */
function coordenadas(doc: Document, scripts: string): Anuncio['coords'] {
  const c = /center=(-?[\d.]+)%2C(-?[\d.]+)/.exec(scripts)
  if (!c) return undefined
  const visibilidad = /["']?addressVisibility["']?\s*:\s*["'](\w+)["']/.exec(scripts)?.[1]
  const marcador = /markerVisible\s*:\s*(\d+)/.exec(scripts)?.[1]
  const aproximada = visibilidad
    ? visibilidad !== 'EXACT'
    : !!doc.querySelector('.no-show-address-feedback') || marcador !== '1'
  return { lat: Number(c[1]), lon: Number(c[2]), aproximada }
}

function precio(doc: Document, scripts: string): number | undefined {
  const t = texto(doc.querySelector('.info-data .info-data-price')).replace(/\D/g, '')
  if (t) return Number(t)
  const b = /buyingPrice\s*:\s*([\d.]+)/.exec(scripts)?.[1]
  return b ? Number(b) : undefined
}

/** Texto con `<br>` como salto de línea. */
function textoConSaltos(n: Node): string {
  if (n.nodeType === 3) return n.textContent ?? ''
  if (n.nodeName === 'BR') return '\n'
  return [...n.childNodes].map(textoConSaltos).join('')
}

function descripcion(doc: Document): string {
  const el = [...doc.querySelectorAll('.comment .adCommentsLanguage')].find(
    (e) => !e.closest('.new-dev-promo'),
  )
  return el ? textoConSaltos(el).trim() : ''
}

export function extraerAnuncio(doc: Document, url: string): Anuncio | null {
  const id = idDeUrl(url)
  if (!id) return null

  const scripts = [...doc.querySelectorAll('script')].map((s) => s.textContent ?? '').join('\n')
  const sec = secciones(doc)
  const basicas = sec.get('Características básicas') ?? []
  const features = texto(doc.querySelector('.info-features'))
  const desc = descripcion(doc)
  const menciones = [...basicas, features, desc].join('\n')
  const planta = (sec.get('Edificio') ?? []).map(parsearPlanta).find(Boolean)
  const anio = basicas.map((l) => /Construido en (\d{4})/.exec(l)?.[1]).find(Boolean)

  return {
    portal: 'idealista',
    id,
    url: `https://www.idealista.com/inmueble/${id}/`,
    precio: precio(doc, scripts),
    tipo: parsearTipo(texto(doc.querySelector('.main-info__title-main'))),
    obraNueva: /obra nueva/i.test(features) || basicas.includes('Promoción de obra nueva'),
    ...ubicacion(doc),
    coords: coordenadas(doc, scripts),
    planta,
    ...parsearSuperficies(basicas),
    anio: anio ? Number(anio) : undefined,
    descripcion: desc,
    mencionaTrastero: /trastero/i.test(menciones),
    mencionaGaraje: /garaje|parking|aparcamiento/i.test(menciones),
  }
}
