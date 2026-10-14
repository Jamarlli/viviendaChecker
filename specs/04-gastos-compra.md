# 04 · Gastos de compra

Estimación de impuestos y gastos sobre el precio del anuncio.

## Modelo
```ts
Rango { min: number; max: number }   // impuestos: min = max
PartidaGasto { concepto: 'itp' | 'iva' | 'igic' | 'ipsi' | 'ajd' | 'notaria' | 'registro' | 'gestoria'; importe: Rango }
Gastos { comunidad: string; desglose: PartidaGasto[]; total: Rango; nota?: string }
```

## Reglas
- Segunda mano: ITP, tipo general de la comunidad autónoma.
- Obra nueva: IVA 10 % + AJD de la comunidad autónoma. En Canarias, IGIC 7 %; en Ceuta y Melilla, IPSI 4 %; en lugar del IVA (`obraNueva` en la tabla).
- IGIC/IPSI: se aplica el tipo general. Los reducidos (vivienda habitual, VPO…) van en `Gastos.nota` con sus condiciones.
- Notaría, registro y gestoría: rango fijo estimado.
- Tabla de tipos en `data/impuestos.json`, con fecha y fuente por comunidad.
- ITP por tramos (`itp.modo`): `marginal` (cada porción a su tipo) o `total` (todo el valor al tipo de su tramo). Un tramo aplica al valor que excede de `desde`.
- Importes redondeados a céntimos.

## Criterios
- [ ] Provincia → comunidad autónoma (incluidas Ceuta y Melilla), ignorando tildes, mayúsculas y variantes. Desconocida → no se calcula.
- [ ] Devuelve desglose y total.
- [ ] Sin precio o sin provincia → no se calcula.
- [ ] Obra nueva en Canarias, Ceuta y Melilla: IGIC/IPSI en lugar de IVA, con nota de tipos reducidos.
- [ ] Nota fija: "Tipo general. Puede haber tipos reducidos (jóvenes, familia numerosa…) y la base puede ser el valor de referencia si es mayor que el precio."

## Fuera de alcance
Tipos reducidos · gastos de hipoteca · valor de referencia.
