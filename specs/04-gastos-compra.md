# 04 · Gastos de compra

Estimación de impuestos y gastos sobre el precio del anuncio.

## Reglas
- Segunda mano: ITP, tipo general de la comunidad autónoma.
- Obra nueva: IVA 10 % + AJD de la comunidad autónoma.
- Notaría, registro y gestoría: rango fijo estimado.
- Tabla de tipos en `data/impuestos.json`, con fecha y fuente por comunidad.

## Criterios
- [ ] Provincia → comunidad autónoma (incluidas Ceuta y Melilla).
- [ ] Devuelve desglose y total.
- [ ] Sin precio o sin provincia → no se calcula.
- [ ] Nota fija: "Tipo general. Puede haber tipos reducidos (jóvenes, familia numerosa…) y la base puede ser el valor de referencia si es mayor que el precio."

## Fuera de alcance
Tipos reducidos · gastos de hipoteca · valor de referencia.

## Dudas
- Recopilar tipos vigentes 2026 por comunidad (issue propia).
