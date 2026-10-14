// Uso: npm run medir   (node --import ./scripts/cargador-ts.mjs scripts/medir-emparejamiento.mjs)
// Mide `emparejar` con la API real del Catastro sobre fixtures/idealista/esperado y el
// desplazamiento de las coords de Idealista. Genera docs/medicion-emparejamiento.md
// (conserva lo escrito a mano desde "## Análisis"). Respuestas cacheadas en node_modules/.cache.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emparejar } from '../src/core/emparejamiento/flujo.ts'
import { separarVia } from '../src/core/emparejamiento/via.ts'
import { crearClienteCatastro } from '../src/adapters/catastro/cliente.ts'

const ESPERADOS = 'fixtures/idealista/esperado'
const SALIDA = 'docs/medicion-emparejamiento.md'
const CACHE = 'node_modules/.cache/medicion-catastro'
const PAUSA_MS = 1100
const BASE = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/'
const CALLEJERO = `${BASE}COVCCallejero.svc/json/`
const COORDENADAS = `${BASE}COVCCoordenadas.svc/json/`

mkdirSync(CACHE, { recursive: true })
let peticiones = 0
let cola = Promise.resolve()
let ultima = 0

/** fetch en serie, con pausa entre peticiones y caché en disco. */
async function fetchLento(url) {
  const fichero = join(CACHE, createHash('sha1').update(String(url)).digest('hex') + '.json')
  if (existsSync(fichero)) return new Response(readFileSync(fichero, 'utf8'))
  const turno = cola.then(async () => {
    const espera = ultima + PAUSA_MS - Date.now()
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    try {
      const res = await fetch(url)
      const texto = await res.text()
      if (res.ok) writeFileSync(fichero, texto)
      return { status: res.status, texto }
    } finally {
      ultima = Date.now()
      peticiones++
    }
  })
  cola = turno.catch(() => {})
  const { status, texto } = await turno
  return new Response(texto, { status })
}

const json = async (url) => {
  try {
    return Object.values(JSON.parse(await (await fetchLento(url)).text()))[0] ?? {}
  } catch {
    return {}
  }
}
const lista = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])

function distancia(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Centroide de la parcela (14 car.). */
async function centroide(pc, provincia, municipio) {
  const q = new URLSearchParams({
    Provincia: provincia,
    Municipio: municipio,
    SRS: 'EPSG:4326',
    RefCat: pc,
  })
  const r = await json(`${COORDENADAS}Consulta_CPMRC?${q}`)
  const geo = lista(r.coordenadas?.coord)[0]?.geo
  return geo ? { lat: Number(geo.ycen), lon: Number(geo.xcen) } : undefined
}

/** Números cercanos a `numero` en la vía: [{ num, pc }]. */
async function numerero(prov, mun, sigla, calle, numero) {
  const q = new URLSearchParams({
    Provincia: prov,
    Municipio: mun,
    TipoVia: sigla,
    NomVia: calle,
    Numero: String(numero),
  })
  const r = await json(`${CALLEJERO}ObtenerNumerero?${q}`)
  return lista(r.nump).map((n) => ({ num: Number(n.num?.pnp), pc: `${n.pc.pc1}${n.pc.pc2}` }))
}

/** Parcelas a ≤ ~25 m del punto (distancia al polígono) y municipio/provincia según el Catastro. */
async function alrededor({ lat, lon }) {
  const q = new URLSearchParams({ CoorX: String(lon), CoorY: String(lat), SRS: 'EPSG:4326' })
  const r = await json(`${COORDENADAS}Consulta_RCCOOR_Distancia?${q}`)
  const parcelas = lista(r.coordenadas_distancias?.coordd)
    .flatMap((c) => lista(c.lpcd))
    .map((p) => ({ pc: `${p.pc.pc1}${p.pc.pc2}`, ldt: p.ldt ?? '', dis: Number(p.dis) }))
  if (!parcelas[0]) return { parcelas }
  const dnprc = await json(`${CALLEJERO}Consulta_DNPRC?RefCat=${parcelas[0].pc}`)
  const dt = lista(dnprc.lrcdnp?.rcdnp)[0]?.dt ?? lista(dnprc.bico)[0]?.bi?.dt
  return { parcelas, municipio: dt?.nm, provincia: dt?.np }
}

/**
 * Distancia mínima del punto a una parcela de la vía (centroides), muestreando el numerero
 * de grueso a fino. Cota inferior del desplazamiento real: la parcela está en esa vía.
 */
async function distanciaAVia(punto, prov, mun, via) {
  const { sigla, calle } = separarVia(via)
  const vistos = new Map()
  const medir = async (pc) => {
    if (!vistos.has(pc)) {
      const c = await centroide(pc, prov, mun)
      vistos.set(pc, c ? distancia(punto, c) : Infinity)
    }
    return vistos.get(pc)
  }
  const muestra = async (n) => {
    const nums = await numerero(prov, mun, sigla, calle, n)
    if (!nums.length) return undefined
    const cerca = nums.reduce((a, b) => (Math.abs(b.num - n) < Math.abs(a.num - n) ? b : a))
    return { n: cerca.num, d: await medir(cerca.pc), nums }
  }
  // Último número: búsqueda exponencial y luego binaria.
  if (!(await muestra(1))) return { error: `vía ${sigla} ${calle} sin números en ${mun}` }
  let alto = 2
  while (alto < 4096 && (await numerero(prov, mun, sigla, calle, alto)).length) alto *= 2
  let bajo = alto / 2
  while (alto - bajo > 4) {
    const m = Math.floor((alto + bajo) / 2)
    if ((await numerero(prov, mun, sigla, calle, m)).length) bajo = m
    else alto = m
  }
  const max = bajo
  // Grueso, luego afinar alrededor del mejor (dos veces) y medir todos sus vecinos.
  let paso = Math.max(2, Math.ceil(max / 12))
  let centro = 1
  let rango = [1, max]
  for (let ronda = 0; ronda < 3; ronda++) {
    let mejor
    for (let n = rango[0]; n <= rango[1]; n += paso) {
      const s = await muestra(n)
      if (s && (!mejor || s.d < mejor.d)) mejor = s
    }
    if (!mejor) break
    centro = mejor.n
    rango = [Math.max(1, centro - paso), Math.min(max, centro + paso)]
    paso = Math.max(1, Math.ceil(paso / 4))
  }
  for (const { pc } of await numerero(prov, mun, sigla, calle, centro)) await medir(pc)
  const d = Math.min(...vistos.values())
  return {
    d,
    detalle: `${sigla} ${calle}: ${vistos.size} parcelas, máx. nº ${max}, mejor ~${centro}`,
  }
}

const mediana = (xs) => percentil(xs, 50)
function percentil(xs, p) {
  const s = [...xs].sort((a, b) => a - b)
  if (!s.length) return NaN
  const i = (p / 100) * (s.length - 1)
  const lo = Math.floor(i)
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)
}
const f = (x, dec = 2) => (x == null || Number.isNaN(x) ? '—' : x.toFixed(dec))
const m = (x) => (x == null || !Number.isFinite(x) ? '—' : String(Math.round(x)))

// --- Medición ---
const catastro = crearClienteCatastro(fetchLento)
const almacen = { leer: async () => undefined, guardar: async () => {} }
const anuncios = readdirSync(ESPERADOS)
  .filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(join(ESPERADOS, n), 'utf8')))

const filas = []
const desplazamientos = []
const exactos = []
for (const a of anuncios) {
  console.log(`${a.id}…`)
  const r = await emparejar(a, { catastro, almacen })
  const e = r.ok ? r.valor : undefined
  const [c1, c2] = e?.candidatos ?? []
  filas.push({ a, r, c1, c2 })

  if (!a.coords) continue
  const punto = a.coords
  const tieneNumero = Boolean(a.direccion?.via && a.direccion?.numero)
  if (tieneNumero && e?.origen === 'direccion' && e.candidatos.length) {
    const pcs = [...new Set(e.candidatos.map((c) => c.inmueble.rc.slice(0, 14)))]
    const ds = []
    for (const pc of pcs) {
      const c = await centroide(pc, a.provincia, a.municipio)
      if (c) ds.push({ pc, d: distancia(punto, c) })
    }
    const pc1 = c1.inmueble.rc.slice(0, 14)
    const cerca = await alrededor(punto)
    const enRadio = cerca.parcelas.find((p) => p.pc === pc1)
    desplazamientos.push({
      a,
      tipo: 'exacta',
      // La parcela real es una de las de la dirección: la más cercana es cota inferior.
      d: Math.min(...ds.map((x) => x.d)),
      detalle:
        `${pcs.length} parcela(s); centroide de la del 1.º (${pc1}) a ${m(ds.find((x) => x.pc === pc1)?.d)} m` +
        (enRadio ? `; RCCOOR la da a ${enRadio.dis} m` : '; fuera de RCCOOR_Distancia'),
    })
    exactos.push({ a, e, c1, c2 })
  } else if (a.direccion?.via) {
    const cerca = await alrededor(punto)
    const prov = cerca.provincia ?? a.provincia
    const mun = cerca.municipio ?? a.municipio
    const { calle } = separarVia(a.direccion.via)
    const enVia = cerca.parcelas.filter((p) => p.ldt.includes(` ${calle} `))
    const busqueda = await distanciaAVia(punto, prov, mun, a.direccion.via)
    const d = Math.min(busqueda.d ?? Infinity, ...enVia.map((p) => p.dis))
    desplazamientos.push({
      a,
      tipo: 'calle',
      d: Number.isFinite(d) ? d : undefined,
      detalle:
        (busqueda.error ?? busqueda.detalle) +
        (enVia.length
          ? `; RCCOOR: parcela de la vía a ${Math.min(...enVia.map((p) => p.dis))} m`
          : '') +
        (mun !== a.municipio ? `; municipio Catastro: ${mun}` : ''),
    })
  }
}

// --- Informe ---
const conteo = { alta: 0, media: 0, baja: 0, ninguna: 0, error: 0 }
for (const { r } of filas) conteo[r.ok ? r.valor.confianza : 'error']++

const tabla = [
  '| id | tipo | aprox. | origen | nº cand. | 1.º | 2.º | ventaja | confianza | uso 1.º | m² 1.º (anuncio) | planta 1.º (anuncio) | año 1.º (anuncio) |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...filas
    .map(({ a, r, c1, c2 }) => {
      const e = r.ok ? r.valor : undefined
      const i = c1?.inmueble
      const m2a = a.m2Construidos ?? (a.m2Utiles ? `${a.m2Utiles} út.` : '—')
      return [
        a.id,
        a.tipo ?? '—',
        a.coords ? (a.coords.aproximada ? 'sí' : 'no') : 'sin coords',
        e?.origen ?? '—',
        e?.candidatos.length ?? '—',
        f(c1?.puntuacion),
        f(c2?.puntuacion),
        c1 ? f(c1.puntuacion - (c2?.puntuacion ?? 0)) : '—',
        e?.confianza ?? `error: ${r.error.tipo}`,
        i?.uso ?? '—',
        i ? `${i.m2} (${m2a})` : '—',
        i ? `${i.planta} (${a.planta ?? '—'})` : '—',
        i ? `${i.anio} (${a.anio ?? '—'})` : '—',
      ].join(' | ')
    })
    .map((l) => `| ${l} |`),
]

const ds = (tipo) => desplazamientos.filter((x) => x.tipo === tipo && x.d != null).map((x) => x.d)
const resumen = (xs) =>
  `n=${xs.length} · mediana ${m(mediana(xs))} m · p95 ${m(percentil(xs, 95))} m · máx. ${m(Math.max(...xs))} m`
const tablaDesp = [
  '| id | dirección | aprox. | distancia (m) | detalle |',
  '|---|---|---|---|---|',
  ...desplazamientos.map(
    ({ a, d, detalle }) =>
      `| ${a.id} | ${a.direccion.via}${a.direccion.numero ? `, ${a.direccion.numero}` : ''} (${a.municipio}) | ${a.coords.aproximada ? 'sí' : 'no'} | ${m(d)} | ${detalle} |`,
  ),
]

const tablaExactos = exactos.map(({ a, e, c1 }) => {
  const m2 = a.m2Construidos
  const planta = a.planta
  const coinciden = e.candidatos.filter((c) => c.puntuacion === c1.puntuacion).length
  const i = c1.inmueble
  return `- **${a.id}** (${a.direccion.via}, ${a.direccion.numero}; ${planta ? `planta ${planta}` : 'sin planta'}, ${m2 ?? '—'} m², año ${a.anio ?? '—'}): 1.º \`${i.rc}\` ${i.uso}, ${i.m2} m², planta ${i.planta || '—'} pta. ${i.puerta || '—'}, ${i.anio}; puntuación ${f(c1.puntuacion)}, empatados en cabeza: ${coinciden} de ${e.candidatos.length}.`
})

const generado = `# Medición del emparejamiento (#26)

Generado con \`npm run medir\` (\`scripts/medir-emparejamiento.mjs\`) el ${new Date().toISOString().slice(0, 10)} contra la API real del Catastro: ${anuncios.length} anuncios de \`fixtures/idealista/esperado\`, sin selección manual, pesos y umbrales de \`src/core/emparejamiento/constantes.ts\`. ${peticiones} peticiones nuevas (resto de caché), en serie, ≥ ${PAUSA_MS / 1000} s entre ellas.

## Emparejamiento por anuncio

Confianza: alta ${conteo.alta} · media ${conteo.media} · baja ${conteo.baja} · ninguna ${conteo.ninguna} · error ${conteo.error}.

${tabla.join('\n')}

Ventaja = 1.º − 2.º (sin 2.º, 1.º). Entre paréntesis, el dato del anuncio.

## Anuncios con número (exactos)

${tablaExactos.join('\n')}

## Desplazamiento de las coordenadas

- Con número: distancia del punto del anuncio al centroide (\`Consulta_CPMRC\`) más cercano de las parcelas que \`DNPLOC\` da para esa dirección (si hay varias, cota inferior).
- Solo calle: distancia mínima del punto a los centroides de las parcelas de esa vía, muestreando \`ObtenerNumerero\` de grueso a fino (más las parcelas de la vía que \`RCCOOR_Distancia\` devuelva en el punto). Es una **cota inferior**: el inmueble está en esa vía, pero no sabemos en qué número. El municipio se toma del Catastro en el punto (Idealista da "La Moraleja", "Ciudalcampo"…).
- Centroide ≠ polígono: para parcelas grandes la distancia al borde es menor.

Exactas: ${resumen(ds('exacta'))}.
Solo calle (cota inferior): ${resumen(ds('calle'))}.
Todas: ${resumen([...ds('exacta'), ...ds('calle')])}.

${tablaDesp.join('\n')}
`

const previo = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : ''
const i = previo.indexOf('## Análisis')
const analisis = i >= 0 ? previo.slice(i) : '## Análisis\n\nPendiente.\n'
mkdirSync('docs', { recursive: true })
writeFileSync(SALIDA, `${generado}\n${analisis}`)
console.log(`${SALIDA} · ${peticiones} peticiones`)
