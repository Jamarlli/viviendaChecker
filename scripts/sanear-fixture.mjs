// Uso: node scripts/sanear-fixture.mjs <raw.html>... [--out fixtures/idealista]
// Genera un HTML mínimo con los nodos que usa la extracción y sin datos personales.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseHTML } from 'linkedom'

const AGENCIA = 'Inmobiliaria Ejemplo'
const NODOS = [
  '.main-info__title',
  'div.info-data',
  'div.info-features',
  '.detail-info-tags',
  '.details-property',
  '#headerMap',
  '#static-map-container',
]
const BASURA = 'script, link, style, img, svg, button, figure, iframe, a, input, form'
const ATRIBUTOS = new Set(['class', 'id'])

// Admite teléfonos ofuscados ("6.0. 0 1.2. 3 4.5. 6").
const TELEFONO = /(\+|00)?(34[\s.-]?)?\b[6789](?:[\s.\-/()]{0,3}\d){8}\b/g
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const URL = /\b(https?:\/\/|www[.\s])\S+/gi
const CIF = /\b[ABCDEFGHJNPQRSUVW]-?\d{7}[0-9A-J]\b/g
const REGISTRO = /\b(AICAT|API|RAICV|CIF|NIF)\b([^\d<]{0,12})\d[\d.-]*/g
const REFERENCIA = /\b(ref(?:erencia)?\b\.?:?[\s*]*)[A-Z0-9-]*\d[A-Z0-9-]{3,}/gi
const REFERENCIA_FINAL = /(^|\s)([A-Z]{1,4}-?\d{4,}[A-Z0-9-]*|\d{5,})\s*$/
// Frase que sitúa la oficina de la agencia.
const FRASE_OFICINA = /[^.!?\n]*\b(oficina|ubicad[oa]s?|situad[oa]s?)\b[^.!?\n]*/gi
const VIA_CON_NUMERO =
  /\b(C\/|Calle|Paseo|Avda\.?|Avenida|Plaza|Pza\.?|Ronda|Camino|Gran Vía)\s*[^,.<*\d]{2,50}?,?\s*\d+[A-Za-z]?\b/gi
const FRASE_AGENCIA = new RegExp(`[^.!?\\n]*${AGENCIA}[^.!?\\n]*`, 'g')
const GENERICAS = new Set(
  'profesional particular promotora inmobiliaria dpto barrio distrito zona centro comercial consultor asesor real estate group capital international realty advisors mmc de del la el madrid barcelona valencia sevilla salamanca chamberi moraleja aravaca'.split(
    ' ',
  ),
)

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Nombres del anunciante y sus fragmentos distintivos (p. ej. "Pérez" de "Grupo Pérez Casas"). */
function nombresAnunciante(doc, html) {
  const nombres = new Set()
  const sel =
    '.advertiser-name, .professional-name, .about-advertiser-name, .chat-info-banner-text strong'
  for (const n of doc.querySelectorAll(sel)) nombres.add(n.textContent.normalize('NFC'))
  for (const m of html.matchAll(/commercialName"?\s*:\s*["']([^"']+)/g))
    nombres.add(m[1].normalize('NFC'))
  const trozos = new Set()
  for (const n of nombres) {
    const palabras = n
      .replace(/[\s.]+$/, '')
      .trim()
      .split(/\s+/)
    for (let i = 0; i < palabras.length; i++)
      for (let j = i + 1; j <= palabras.length; j++) {
        const p = palabras.slice(i, j)
        if (p.every((w) => GENERICAS.has(w.toLowerCase().replace(/\W/g, '')))) continue
        if (p.length === 1 && p[0].length < 4) continue
        trozos.add(p.join(' '))
      }
  }
  return [...trozos]
    .sort((a, b) => b.length - a.length)
    .map((t) => new RegExp(`(?<!\\p{L})${escapar(t)}(?!\\p{L})`, t.length >= 6 ? 'giu' : 'gu'))
}

function limpiarTexto(texto, nombres) {
  let t = texto
    .normalize('NFC')
    .replace(EMAIL, '[email]')
    .replace(URL, '[web]')
    .replace(CIF, '[CIF]')
    .replace(REGISTRO, '$1$2[n.º]')
    .replace(TELEFONO, '[teléfono]')
    .replace(REFERENCIA, '$1[ref]')
    .replace(REFERENCIA_FINAL, '$1[ref]')
    .replace(FRASE_OFICINA, (f) => f.replace(VIA_CON_NUMERO, '[dirección]'))
  for (const n of nombres) t = t.replace(n, AGENCIA)
  // El año de fundación identifica a la agencia.
  return t.replace(FRASE_AGENCIA, (f) => f.replace(/\b(desde|en) (19|20)\d{2}\b/gi, '$1 [año]'))
}

/** Quita lo que no usa la extracción; con `nombres`, sanea además el texto. */
function limpiarNodo(nodo, nombres) {
  if (!nodo) return ''
  for (const b of nodo.querySelectorAll(BASURA)) b.remove()
  for (const el of [nodo, ...nodo.querySelectorAll('*')])
    for (const a of [...el.attributes]) if (!ATRIBUTOS.has(a.name)) el.removeAttribute(a.name)
  if (!nombres) return nodo.outerHTML
  nodo.normalize() // une textos partidos por entidades (&amp;, &ouml;…)
  const walker = nodo.ownerDocument.createTreeWalker(nodo, 4 /* SHOW_TEXT */)
  for (let t = walker.nextNode(); t; t = walker.nextNode())
    t.textContent = limpiarTexto(t.textContent, nombres)
  return nodo.outerHTML
}

/** Descripción del anuncio: el primer `.comment` fuera del bloque de promoción. */
function descripcion(doc, nombres) {
  const c = [...doc.querySelectorAll('.comment')].find((n) => !n.closest('.new-dev-promo'))
  const p = c?.querySelector('.adCommentsLanguage')
  if (!p) return ''
  return limpiarNodo(p, nombres)
}

function configMapa(html, id) {
  const carrusel = html.match(/multimediaCarrousel:\s*(\{.*\})\s*,?\s*\n/)
  const mapa = carrusel ? JSON.parse(carrusel[1]).map : undefined
  if (mapa?.src) mapa.src = mapa.src.replace(/([?&])(key|signature)=[^&]*/g, '$1$2=FICTICIA')
  const precio = html.match(/buyingPrice:\s*([\d.]+)/)?.[1]
  const location = html.match(/locationId:\s*'([^']*)'/)?.[1]
  const marker = html.match(/markerVisible:\s*(\d+)/)?.[1]
  return `<script>
var config = {
  propertyId: ${id},
  idForm: { adId: ${id}, buyingPrice: ${precio}, locationId: '${location}' },
  multimediaCarrousel: ${JSON.stringify({ map: mapa })},
};
var mapConfig = { latitude: '', longitude: '', markerVisible: ${marker} };
</script>`
}

function sanear(html) {
  const { document: doc } = parseHTML(html)
  const original = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? ''
  const id = original.match(/\/inmueble\/(\d+)\//)?.[1]
  if (!id) throw new Error('Sin URL canónica de inmueble')
  // Se reconstruye en vez de copiarla: solo lleva el id.
  const canonical = `https://www.idealista.com/inmueble/${id}/`
  const nombres = nombresAnunciante(doc, html)
  const nodos = NODOS.map((s) => limpiarNodo(doc.querySelector(s)))
  const titulo = limpiarTexto(
    doc.querySelector('.main-info__title-main')?.textContent.trim() ?? '',
    nombres,
  ).replace(/[&<>]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt' }[c]};`)
  const html2 = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<link rel="canonical" href="${canonical}">
</head>
<body>
<!-- Fixture saneado con scripts/sanear-fixture.mjs. Datos personales sustituidos. -->
${configMapa(html, id)}
${nodos.slice(0, 4).join('\n')}
<div class="comment">${descripcion(doc, nombres)}</div>
<section id="details" class="details-box">${nodos.slice(4, 5).join('\n')}</section>
<div id="mapWrapper">${nodos.slice(5).join('\n')}</div>
</body>
</html>
`
  return { id, html: html2.replace(/\n\s*\n/g, '\n') }
}

const args = process.argv.slice(2)
const i = args.indexOf('--out')
const out = i >= 0 ? args.splice(i, 2)[1] : 'fixtures/idealista'
for (const f of args) {
  const { id, html } = sanear(readFileSync(f, 'utf8'))
  writeFileSync(join(out, `${id}.html`), html)
  console.log(`${f} → ${id}.html`)
}
