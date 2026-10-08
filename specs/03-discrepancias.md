# 03 · Discrepancias

Compara `Anuncio` con el `Inmueble` elegido.

## Modelo
```ts
Discrepancia { campo: 'superficie' | 'anio' | 'uso' | 'planta' | 'anexo'; nivel: 'ok' | 'revisar' | 'aviso'; anuncio?: string; catastro?: string; explicacion: string; pocoFiable?: boolean }
```

## Reglas
| Campo | ok | revisar | aviso |
|---|---|---|---|
| Superficie construida | ≤ 10 % | 10–20 % | > 20 % |
| Superficie solo útil | útil ≤ catastro y ≥ 70 % de catastro | fuera de ese rango | — |
| Año | ±2 | resto | — |
| Uso | Residencial | — | no residencial y anuncio de vivienda |
| Planta | coincide | no coincide | — |
| Anexo | — | anuncio menciona trastero/garaje y la parcela tiene inmuebles de ese uso | — |

Notas:
- Superficie: se usa la construida si existe; si no, la útil. Porcentaje sobre la del Catastro.
- Uso: sin tipo en el anuncio, o no residencial y anuncio que no es de vivienda → no se evalúa.
- Anexo: inmuebles de la parcela, distintos del elegido, con uso almacén/estacionamiento.

## Criterios
- [ ] Cada regla tiene tests de borde (10 %, 20 %, ±2 años).
- [ ] Campo sin dato en el anuncio → no se evalúa.
- [ ] Confianza `baja` o `ninguna` → `pocoFiable: true`; el panel muestra "emparejamiento poco fiable".
- [ ] Explicaciones en lenguaje llano. Ej.: "El Catastro incluye zonas comunes; diferencias de hasta un 10 % son normales."
