# 04 · Gastos de compra

Estimación de impuestos y gastos sobre el precio del anuncio.

## Modelo
```ts
Rango { min: number; max: number }   // impuestos: min = max
PartidaGasto { concepto: 'itp' | 'iva' | 'ajd' | 'notaria' | 'registro' | 'gestoria'; importe: Rango }
Gastos { comunidad: string; desglose: PartidaGasto[]; total: Rango }
```

## Reglas
- Segunda mano: ITP, tipo general de la comunidad autónoma.
- Obra nueva: IVA 10 % + AJD de la comunidad autónoma.
- Notaría, registro y gestoría: rango fijo estimado.
- Tabla de tipos en `data/impuestos.json`, con fecha y fuente por comunidad.
- ITP por tramos (`itp.modo`): `marginal` (cada porción a su tipo) o `total` (todo el valor al tipo de su tramo).

## Criterios
- [ ] Provincia → comunidad autónoma (incluidas Ceuta y Melilla).
- [ ] Devuelve desglose y total.
- [ ] Sin precio o sin provincia → no se calcula.
- [ ] Nota fija: "Tipo general. Puede haber tipos reducidos (jóvenes, familia numerosa…) y la base puede ser el valor de referencia si es mayor que el precio."

## Fuera de alcance
Tipos reducidos · gastos de hipoteca · valor de referencia.

## Dudas
- Obra nueva en Canarias (IGIC) y Ceuta/Melilla (IPSI) no lleva IVA: ¿se modela o se avisa con nota?
