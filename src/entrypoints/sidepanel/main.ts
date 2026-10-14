import './estilo.css'
import type { Analisis } from '../../core/panel/analisis'
import type { EstadoPanel } from '../../core/panel/controlador'
import type { MensajeAlFondo, MensajeAlPanel, RespuestaDe } from '../../core/panel/mensajes'
import {
  enlaces,
  etiquetaInmueble,
  mensajeError,
  NOMBRE_CAMPO,
  NOMBRE_CONCEPTO,
  NOMBRE_NIVEL,
  notasGastos,
  ordenarDiscrepancias,
  textoRango,
  TITULO_ALERTA,
  vistaInmueble,
} from '../../core/panel/vista'

type Hijo = Node | string | false | undefined

function h(etiqueta: string, attrs: Record<string, string> = {}, ...hijos: Hijo[]): HTMLElement {
  const el = document.createElement(etiqueta)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of hijos) if (c) el.append(c)
  return el
}

function boton(texto: string, accion: () => void, clase = ''): HTMLElement {
  const b = h('button', { type: 'button', class: clase }, texto)
  b.addEventListener('click', accion)
  return b
}

function enviar<T extends MensajeAlFondo>(m: T): Promise<RespuestaDe[T['tipo']]> {
  return browser.runtime.sendMessage(m)
}

const app = document.getElementById('app') ?? document.body
let tabActual: number | undefined

function pintar(...hijos: Hijo[]) {
  app.replaceChildren(...hijos.filter((c): c is Node | string => !!c))
}

function render(estado: EstadoPanel) {
  if (estado.tipo === 'noSoportado')
    return pintar(h('p', { class: 'vacio' }, 'Abre un anuncio de Idealista para analizarlo.'))
  if (estado.tipo === 'cargando')
    return pintar(h('p', { class: 'vacio', role: 'status' }, 'Consultando el Catastro…'))
  const a = estado.analisis
  pintar(seccionInmueble(a), seccionDiscrepancias(a), seccionAlertas(a), seccionGastos(a))
}

function seccion(titulo: string, ...hijos: Hijo[]): HTMLElement {
  return h('section', {}, h('h2', {}, titulo), ...hijos)
}

const fuente = (texto: string) => h('p', { class: 'fuente' }, `Fuente: ${texto}`)

function seccionInmueble(a: Analisis): HTMLElement {
  const v = vistaInmueble(a)
  const contenido: Hijo[] = []
  if (v.estado === 'error') contenido.push(h('p', { class: 'aviso', role: 'alert' }, v.mensaje))
  if (v.estado === 'sinCandidatos')
    contenido.push(
      h('p', {}, 'No hemos encontrado el inmueble en el Catastro. Búscalo por calle o pega su RC.'),
    )
  if (v.estado === 'confirmado' || v.estado === 'sinConfirmar') {
    const confirmado = v.estado === 'confirmado'
    contenido.push(
      h(
        'p',
        { class: `sello ${confirmado ? 'ok' : 'revisar'}` },
        confirmado ? 'Confirmado por ti' : `Sin confirmar · ${v.confianza}`,
      ),
      h('p', { class: 'rc' }, v.rc),
      h('p', {}, v.direccion),
      h('p', {}, v.etiqueta),
      !confirmado &&
        h(
          'p',
          { class: 'nota' },
          'Es el candidato más probable, no un dato seguro. Confirma cuál es antes de fiarte de las comparaciones.',
        ),
      fuente('Catastro'),
    )
    if (v.candidatos.length) {
      contenido.push(
        h('h3', {}, '¿Cuál es?'),
        h(
          'ul',
          { class: 'lista' },
          ...v.candidatos.map((c) =>
            h(
              'li',
              {},
              h('span', {}, c.etiqueta, h('small', {}, ` · coincide ${c.coincidencia}`)),
              boton('Es este', () => confirmar(c.rc)),
            ),
          ),
        ),
      )
    }
    contenido.push(
      h(
        'ul',
        { class: 'enlaces' },
        ...enlaces(v.rc).map((e) =>
          h('li', {}, h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.texto)),
        ),
      ),
    )
  }
  if (tabActual !== undefined) contenido.push(busqueda(a, tabActual), pegarRc())
  return seccion('Inmueble', ...contenido)
}

function campo(etiqueta: string, input: HTMLInputElement): HTMLElement {
  return h('label', {}, etiqueta, input)
}

function entrada(valor = '', attrs: Record<string, string> = {}): HTMLInputElement {
  const i = h('input', { type: 'text', ...attrs }) as HTMLInputElement
  i.value = valor
  return i
}

function busqueda(a: Analisis, tab: number): Hijo {
  const { provincia, municipio, direccion } = a.anuncio
  if (!provincia || !municipio) return false
  const via = entrada(direccion?.via, { autocomplete: 'off' })
  const numero = entrada(direccion?.numero, { inputmode: 'numeric', size: '5' })
  const resultado = h('div', { 'aria-live': 'polite' })

  async function buscar() {
    resultado.replaceChildren(h('p', { role: 'status' }, 'Buscando…'))
    const r = await enviar({ tipo: 'buscarNumeros', tab, via: via.value, numero: numero.value })
    if (!r.ok)
      return resultado.replaceChildren(
        h(
          'p',
          {},
          r.error.tipo === 'sinResultados'
            ? 'No hay números para esa calle.'
            : mensajeError(r.error),
        ),
      )
    resultado.replaceChildren(
      h('p', {}, 'Elige el número:'),
      h(
        'div',
        { class: 'numeros' },
        ...r.valor.map((n) => boton(n.numero, () => void inmuebles(n.pc, n.numero))),
      ),
    )
  }

  async function inmuebles(pc: string, num: string) {
    resultado.replaceChildren(h('p', { role: 'status' }, 'Buscando…'))
    const r = await enviar({ tipo: 'inmueblesParcela', tab, pc })
    if (!r.ok) return resultado.replaceChildren(h('p', {}, mensajeError(r.error)))
    resultado.replaceChildren(
      h('p', {}, `Número ${num}: elige planta y puerta.`),
      h(
        'ul',
        { class: 'lista' },
        ...r.valor.map((c) =>
          h(
            'li',
            {},
            h('span', {}, etiquetaInmueble(c.inmueble)),
            boton('Es este', () => confirmar(c.inmueble.rc)),
          ),
        ),
      ),
    )
  }

  const form = h(
    'form',
    { class: 'fila' },
    campo('Calle', via),
    campo('Número', numero),
    h('button', { type: 'submit' }, 'Ver números'),
  )
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void buscar()
  })
  return h('details', {}, h('summary', {}, 'Buscar por calle y número'), form, resultado)
}

function pegarRc(): HTMLElement {
  const rc = entrada('', { autocomplete: 'off', maxlength: '24', spellcheck: 'false' })
  const aviso = h('p', { 'aria-live': 'polite' })
  const form = h(
    'form',
    { class: 'fila' },
    campo('Referencia catastral (20 caracteres)', rc),
    h('button', { type: 'submit' }, 'Usar'),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!(await confirmar(rc.value))) aviso.textContent = 'La RC debe tener 20 letras o números.'
  })
  return h('details', {}, h('summary', {}, 'Pegar referencia catastral'), form, aviso)
}

async function confirmar(rc: string): Promise<boolean> {
  if (tabActual === undefined) return false
  return enviar({ tipo: 'confirmar', tab: tabActual, rc })
}

function seccionDiscrepancias(a: Analisis): Hijo {
  if (!a.discrepancias.length) return false
  const confirmado = a.emparejamiento?.origen === 'manual'
  const pocoFiable = a.discrepancias.some((d) => d.pocoFiable)
  return seccion(
    'Anuncio frente a Catastro',
    pocoFiable && h('p', { class: 'aviso' }, 'Emparejamiento poco fiable.'),
    !confirmado && h('p', { class: 'nota' }, 'Comparado con un inmueble sin confirmar.'),
    h(
      'ul',
      { class: 'discrepancias' },
      ...ordenarDiscrepancias(a.discrepancias).map((d) =>
        h(
          'li',
          { class: d.nivel },
          h('strong', {}, `${NOMBRE_NIVEL[d.nivel]} · ${NOMBRE_CAMPO[d.campo]}`),
          (d.anuncio || d.catastro) &&
            h(
              'p',
              { class: 'datos' },
              [d.anuncio && `Anuncio: ${d.anuncio}`, d.catastro && `Catastro: ${d.catastro}`]
                .filter(Boolean)
                .join(' · '),
            ),
          h('p', {}, d.explicacion),
        ),
      ),
    ),
  )
}

function seccionAlertas(a: Analisis): Hijo {
  if (!a.alertas.length) return false
  return seccion(
    'En el texto del anuncio',
    h(
      'ul',
      { class: 'alertas' },
      ...a.alertas.map((x) =>
        h('li', {}, h('strong', {}, TITULO_ALERTA[x.tipo]), h('blockquote', {}, x.frase)),
      ),
    ),
    fuente('descripción del anuncio'),
  )
}

function seccionGastos(a: Analisis): Hijo {
  const g = a.gastos
  if (!g) return false
  return seccion(
    'Gastos de compra',
    h(
      'table',
      {},
      h('caption', {}, `Estimación para ${g.comunidad}`),
      h(
        'tbody',
        {},
        ...g.desglose.map((p) =>
          h(
            'tr',
            {},
            h('th', { scope: 'row' }, NOMBRE_CONCEPTO[p.concepto]),
            h('td', {}, textoRango(p.importe)),
          ),
        ),
      ),
      h(
        'tfoot',
        {},
        h('tr', {}, h('th', { scope: 'row' }, 'Total'), h('td', {}, textoRango(g.total))),
      ),
    ),
    ...notasGastos(g).map((n) => h('p', { class: 'nota' }, n)),
    fuente('precio del anuncio y tipos 2026 de Hacienda'),
  )
}

async function cambiarTab(tab: number | undefined) {
  tabActual = tab
  if (tab === undefined) return render({ tipo: 'noSoportado' })
  const estado = await enviar({ tipo: 'pedirEstado', tab })
  if (tab === tabActual) render(estado)
}

browser.runtime.onMessage.addListener((m: MensajeAlPanel) => {
  if (m.tipo === 'estado' && m.tab === tabActual) render(m.estado)
})

browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const actual = await browser.windows.getCurrent()
  if (windowId === actual.id) void cambiarTab(tabId)
})

browser.tabs
  .query({ active: true, currentWindow: true })
  .then(([activa]) => cambiarTab(activa?.id), console.error)
