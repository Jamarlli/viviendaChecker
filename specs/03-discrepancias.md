# 03 · Discrepancias

Compara `Anuncio` con el `Inmueble` elegido.

## Modelo
```ts
Discrepancia { campo: 'superficie' | 'anio' | 'uso' | 'planta' | 'anexo'; nivel: 'ok' | 'revisar' | 'aviso'; anuncio?: string; catastro?: string; explicacion: string; pocoFiable?: boolean }
```

## Reglas
| Campo | ok | revisar | aviso |
|---|---|---|---|
| Superficie construida | ≤ 10 % | 10–20 %, o > 10 % explicada por un anexo | > 20 % sin anexo que la explique |
| Superficie solo útil | útil ≤ catastro y ≥ 70 % de catastro | fuera de ese rango | — |
| Año | ±2 | resto | — |
| Uso | Residencial | — | no residencial y anuncio de vivienda |
| Planta | coincide | no coincide | — |
| Anexo | — | anuncio menciona trastero/garaje, la parcela tiene inmuebles de ese uso y la superficie no se explicó ya por un anexo | — |

Notas:
- Superficie: se usa la construida si existe; si no, la útil. Porcentaje sobre la del Catastro.
- Superficie construida explicada por un anexo: diferencia > 10 % y anuncio = vivienda + anexo con la regla de la spec 02 (`garaje: 'incluido'` o `trastero: true`; plaza ≤ 50 m² de la parcela o 20–35 m²; ±5 % del anuncio), y el anexo cubre al menos lo que pasa del 10 % (anuncio − 1,1 × catastro). Entonces `revisar`, nunca `aviso`, con "El anuncio puede estar sumando el garaje/trastero, que en el Catastro es un inmueble aparte. Pide la superficie de la vivienda sola y comprueba que el anexo entra en la venta." Ej.: anuncio 112, vivienda 100 y trastero de 2 m² → no se explica.
- Parcela: con selección manual, los inmuebles de su parcela (`DNPRC`); por coords, `leidos` (spec 02); por dirección, los candidatos.
- Uso: sin tipo en el anuncio, o no residencial y anuncio que no es de vivienda → no se evalúa.
- Planta: se comparan normalizadas (`core/planta.ts`); si el anuncio queda en `otro` no se evalúa; si es el Catastro, no coincide.
- Anexo: inmuebles de la parcela, distintos del elegido, con uso almacén/estacionamiento.

## Criterios
- [ ] Cada regla tiene tests de borde (10 %, 20 %, ±2 años).
- [ ] Campo sin dato en el anuncio → no se evalúa.
- [ ] Anuncio con garaje incluido cuya superficie ≈ vivienda + plaza → `revisar` con la explicación del garaje y sin discrepancia `anexo` aparte (caso 111109550 con su parcela grabada: 5.ª de 188 m² `ok`, de 163 m² `revisar`, de 146 m² `aviso`).
- [ ] Confianza `baja` o `ninguna` → `pocoFiable: true`; el panel muestra "emparejamiento poco fiable".
- [ ] Explicaciones en lenguaje llano. Ej.: "El Catastro incluye zonas comunes; diferencias de hasta un 10 % son normales."
