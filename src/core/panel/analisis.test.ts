import { describe, expect, it } from 'vitest'
import { analizar } from './analisis'
import { almacenFalso, anuncio, catastroFalso, impuestos, inmueble } from './falsos'

const BUENO = inmueble('1111111VK1111A0001AA')
const OTRO = inmueble('1111111VK1111A0002BB', { m2: 60, planta: '03' })
const TRASTERO = inmueble('1111111VK1111A0003CC', { uso: 'Almacén-Estacionamiento', m2: 5 })

const deps = (r: Parameters<typeof catastroFalso>[0], almacen = almacenFalso().almacen) => ({
  catastro: catastroFalso(r).catastro,
  almacen,
  impuestos,
})

describe('analizar', () => {
  it('compara con el candidato más probable y calcula alertas y gastos', async () => {
    const a = anuncio({ descripcion: 'Piso alquilado a buen inquilino.' })
    const r = await analizar(a, deps({ direccion: { ok: true, valor: [OTRO, BUENO] } }))
    expect(r.emparejamiento?.candidatos[0]?.inmueble.rc).toBe(BUENO.rc)
    expect(r.emparejamiento?.origen).toBe('direccion')
    expect(r.discrepancias.find((d) => d.campo === 'superficie')?.nivel).toBe('ok')
    expect(r.alertas.map((x) => x.tipo)).toEqual(['alquilado'])
    expect(r.gastos?.comunidad).toBe('Madrid')
    expect(r.error).toBeUndefined()
  })

  it('sin candidatos → sin discrepancias', async () => {
    const r = await analizar(anuncio(), deps({}))
    expect(r.emparejamiento).toMatchObject({ candidatos: [], confianza: 'ninguna' })
    expect(r.discrepancias).toEqual([])
  })

  it('error del Catastro → error, con alertas y gastos', async () => {
    const r = await analizar(
      anuncio({ descripcion: 'Vivienda ocupada.' }),
      deps({ direccion: { ok: false, error: { tipo: 'red', mensaje: 'x' } } }),
    )
    expect(r.error).toEqual({ tipo: 'red', mensaje: 'x' })
    expect(r.emparejamiento).toBeUndefined()
    expect(r.alertas).toHaveLength(1)
    expect(r.gastos).not.toBeNull()
  })

  it('selección manual → consulta la parcela para detectar anexos', async () => {
    const { almacen } = almacenFalso({ '42': { rc: BUENO.rc } })
    const f = catastroFalso({
      referencia: (ref) => ({
        ok: true,
        valor: ref.length === 14 ? [BUENO, TRASTERO] : [BUENO],
      }),
    })
    const r = await analizar(anuncio({ mencionaTrastero: true }), {
      catastro: f.catastro,
      almacen,
      impuestos,
    })
    expect(r.emparejamiento?.origen).toBe('manual')
    expect(f.llamadas.map((l) => l.arg)).toContain('1111111VK1111A')
    expect(r.discrepancias.some((d) => d.campo === 'anexo')).toBe(true)
  })

  it('por coords → anexos de los inmuebles leídos, aunque el filtro de superficie los descarte', async () => {
    const a = anuncio({
      direccion: undefined,
      coords: { lat: 40.4, lon: -3.7, aproximada: false },
      mencionaTrastero: true,
    })
    const r = await analizar(
      a,
      deps({
        radio: { ok: true, valor: [{ pc: '1111111VK1111A', direccion: '', distancia: 1 }] },
        referencia: () => ({ ok: true, valor: [BUENO, TRASTERO] }),
      }),
    )
    expect(r.emparejamiento?.candidatos.map((c) => c.inmueble.rc)).toEqual([BUENO.rc])
    expect(r.discrepancias.some((d) => d.campo === 'anexo')).toBe(true)
  })
})
