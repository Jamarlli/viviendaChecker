# Medición del emparejamiento (#26)

Generado con `npm run medir` (`scripts/medir-emparejamiento.mjs`) el 2026-10-14 contra la API real del Catastro: 24 anuncios de `fixtures/idealista/esperado`, sin selección manual, pesos y umbrales de `src/core/emparejamiento/constantes.ts`. 476 peticiones nuevas (resto de caché), en serie, ≥ 1.1 s entre ellas.

## Emparejamiento por anuncio

Confianza: alta 2 · media 12 · baja 9 · ninguna 1 · error 0.

| id | tipo | aprox. | origen | nº cand. | 1.º | 2.º | ventaja | confianza | uso 1.º | m² 1.º (anuncio) | planta 1.º (anuncio) | año 1.º (anuncio) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 104570830 | atico | sí | coords | 136 | 0.65 | 0.65 | 0.00 | media | Residencial | 90 (102) | 00 (7) | 2000 (—) |
| 104685725 | atico | no | direccion | 186 | 0.47 | 0.47 | 0.00 | baja | Residencial | 249 (318) | 07 (7) | 2025 (—) |
| 105996116 | atico | no | direccion | 11 | 1.00 | 0.18 | 0.82 | alta | Residencial | 353 (312) | 02 (—) | 2025 (—) |
| 108505570 | atico | sí | coords | 88 | 0.55 | 0.55 | 0.00 | baja | Residencial | 166 (158) | 05 (8) | 1949 (1991) |
| 109723839 | estudio | sí | coords | 24 | 0.55 | 0.45 | 0.10 | baja | Residencial | 70 (65) | 05 (2) | 1900 (1917) |
| 109776242 | casa | no | direccion | 4 | 1.00 | 1.00 | 0.00 | media | Residencial | 234 (208) | OD (—) | 2006 (2006) |
| 110258143 | piso | sí | coords | 154 | 0.85 | 0.85 | 0.00 | media | Residencial | 195 (193) | 07 (7) | 1939 (1964) |
| 110491789 | piso | sí | coords | 178 | 1.00 | 0.70 | 0.30 | media | Residencial | 197 (192) | 03 (3) | 1900 (1900) |
| 111109550 | piso | sí | coords | 92 | 0.55 | 0.40 | 0.15 | baja | Residencial | 176 (194) | 02 (5) | 1935 (1985) |
| 111181225 | piso | sí | coords | 333 | 0.85 | 0.85 | 0.00 | media | Residencial | 120 (113) | 04 (4) | 1972 (1957) |
| 111337066 | piso | no | direccion | 8 | 1.00 | 0.25 | 0.75 | alta | Residencial | 261 (230) | 03 (3) | 1900 (1900) |
| 111364311 | piso | sí | coords | 101 | 0.85 | 0.70 | 0.15 | media | Residencial | 75 (80) | 03 (3) | 1905 (1900) |
| 111474399 | casa | sí | coords | 0 | — | — | — | ninguna | — | — | — | — |
| 111823157 | piso | sí | coords | 201 | 0.85 | 0.85 | 0.00 | media | Residencial | 82 (87) | 02 (2) | 1940 (1935) |
| 111879794 | casa | sí | coords | 5 | 0.14 | 0.14 | 0.00 | baja | Residencial | 633 (510) | OD (—) | 2000 (2026) |
| 111955729 | piso | sí | coords | 252 | 1.00 | 0.65 | 0.35 | media | Residencial | 107 (114) | 05 (5) | 1966 (—) |
| 112121660 | piso | sí | coords | 101 | 0.55 | 0.55 | 0.00 | baja | Residencial | 85 (80) | 01 (7) | 1985 (1972) |
| 112503762 | duplex | sí | coords | 226 | 1.00 | 1.00 | 0.00 | media | Residencial | 328 (370) | 03 (3) | 2001 (2001) |
| 112517360 | piso | sí | coords | 212 | 0.53 | 0.47 | 0.06 | baja | Comercial | 94 (98) | 00 (1) | 1977 (—) |
| 112551961 | piso | sí | coords | 257 | 1.00 | 1.00 | 0.00 | media | Residencial | 144 (154) | 00 (bajo) | 2000 (—) |
| 112581200 | piso | sí | coords | 207 | 0.85 | 0.85 | 0.00 | media | Residencial | 172 (181) | 06 (6) | 1984 (1966) |
| 112637748 | duplex | sí | coords | 290 | 0.85 | 0.85 | 0.00 | media | Residencial | 182 (165) | 06 (6) | 2019 (2003) |
| 112803255 | casa | sí | coords | 1 | 0.00 | — | 0.00 | baja | Obras de urbanización y jardineria, suelos sin edificar | 0 (215) | UE (—) | 0 (2015) |
| 38041203 | casa | sí | coords | 2 | 0.00 | 0.00 | 0.00 | baja | Deportivo | 6344 (775) | OD (—) | 1995 (—) |

Ventaja = 1.º − 2.º (sin 2.º, 1.º). Entre paréntesis, el dato del anuncio.

## Anuncios con número (exactos)

- **104685725** (Calle de Mesena, 80; planta 7, 318 m², año —): 1.º `4200078VK4749G0047OO` Residencial, 249 m², planta 07 pta. A, 2025; puntuación 0.47, empatados en cabeza: 8 de 186.
- **105996116** (Calle Arturo Soria, 161; sin planta, 312 m², año —): 1.º `4387202VK4848E0015DW` Residencial, 353 m², planta 02 pta. A, 2025; puntuación 1.00, empatados en cabeza: 1 de 11.
- **109776242** (CL Valle De La Orotava, 2; sin planta, 208 m², año 2006): 1.º `1121903VL1012S0001YB` Residencial, 234 m², planta OD pta. OS, 2006; puntuación 1.00, empatados en cabeza: 3 de 4.
- **111337066** (Calle del Consell de Cent, 330; planta 3, 230 m², año 1900): 1.º `0528513DF3802H0006WI` Residencial, 261 m², planta 03 pta. —, 1900; puntuación 1.00, empatados en cabeza: 1 de 8.

## Desplazamiento de las coordenadas

- Con número: distancia del punto del anuncio al centroide (`Consulta_CPMRC`) más cercano de las parcelas que `DNPLOC` da para esa dirección (si hay varias, cota inferior).
- Solo calle: distancia mínima del punto a los centroides de las parcelas de esa vía, muestreando `ObtenerNumerero` de grueso a fino (más las parcelas de la vía que `RCCOOR_Distancia` devuelva en el punto). Es una **cota inferior**: el inmueble está en esa vía, pero no sabemos en qué número. El municipio se toma del Catastro en el punto (Idealista da "La Moraleja", "Ciudalcampo"…).
- Centroide ≠ polígono: para parcelas grandes la distancia al borde es menor.

Exactas: n=4 · mediana 14 m · p95 168 m · máx. 193 m.
Solo calle (cota inferior): n=14 · mediana 123 m · p95 236 m · máx. 243 m.
Todas: n=18 · mediana 119 m · p95 234 m · máx. 243 m.

| id | dirección | aprox. | distancia (m) | detalle |
|---|---|---|---|---|
| 104570830 | Calle de Alcalá (Madrid) | sí | 91 | CL ALCALA: 25 parcelas, máx. nº 732, mejor ~223; municipio Catastro: MADRID |
| 104685725 | Calle de Mesena, 80 (Madrid) | no | 193 | 2 parcela(s); centroide de la del 1.º (4200078VK4749G) a 193 m; fuera de RCCOOR_Distancia |
| 105996116 | Calle Arturo Soria, 161 (Madrid) | no | 25 | 1 parcela(s); centroide de la del 1.º (4387202VK4848E) a 25 m; RCCOOR la da a 0 m |
| 108505570 | Calle de Manuel González Longoria (Madrid) | sí | 126 | CL MANUEL GONZALEZ LONGORIA: 7 parcelas, máx. nº 16, mejor ~3; municipio Catastro: MADRID |
| 109723839 | Calle de Bordadores (Madrid) | sí | 203 | CL BORDADORES: 5 parcelas, máx. nº 16, mejor ~11; municipio Catastro: MADRID |
| 109776242 | CL Valle De La Orotava, 2 (Guadarrama) | no | 0 | 4 parcela(s); centroide de la del 1.º (1121903VL1012S) a 26 m; RCCOOR la da a 20.15 m |
| 110258143 | Calle De en Sanz (València) | sí | 166 | CL EN SANZ: 7 parcelas, máx. nº 16, mejor ~1; municipio Catastro: VALENCIA |
| 110491789 | Calle de Girona (Barcelona) | sí | 41 | CL GIRONA: 21 parcelas, máx. nº 188, mejor ~45; municipio Catastro: BARCELONA |
| 111109550 | Calle de Fernández de la Hoz (Madrid) | sí | 121 | CL FERNANDEZ DE LA HOZ: 17 parcelas, máx. nº 84, mejor ~48; municipio Catastro: MADRID |
| 111337066 | Calle del Consell de Cent, 330 (Barcelona) | no | 3 | 1 parcela(s); centroide de la del 1.º (0528513DF3802H) a 3 m; RCCOOR la da a 0 m |
| 111364311 | Calle de San Andrés (Madrid) | sí | 127 | CL SAN ANDRES: 15 parcelas, máx. nº 40, mejor ~19; municipio Catastro: MADRID |
| 111879794 | Paseo del Rebeco (Ciudalcampo) | sí | 117 | PS REBECO: 2 parcelas, máx. nº 4, mejor ~0; municipio Catastro: SAN SEBASTIAN DE LOS REYES |
| 111955729 | Calle de Fernán González (Madrid) | sí | 22 | CL FERNAN GONZALEZ: 18 parcelas, máx. nº 84, mejor ~28; RCCOOR: parcela de la vía a 21.81 m; municipio Catastro: MADRID |
| 112517360 | Calle Virgen de Valvanera (Sevilla) | sí | 145 | CL VIRGEN DE VALVANERA: 14 parcelas, máx. nº 24, mejor ~19; municipio Catastro: SEVILLA |
| 112551961 | Calle Dodge (Madrid) | sí | 0 | CL DODGE: 4 parcelas, máx. nº 8, mejor ~2; RCCOOR: parcela de la vía a 0 m; municipio Catastro: MADRID |
| 112581200 | Calle de Sant Vicent Màrtir (València) | sí | — | vía CL SANT VICENT MARTIR sin números en VALENCIA; municipio Catastro: VALENCIA |
| 112637748 | Calle del General Oráa (Madrid) | sí | 114 | CL GENERAL ORAA: 18 parcelas, máx. nº 88, mejor ~56; municipio Catastro: MADRID |
| 112803255 | Calle de la Azalea (La Moraleja) | sí | 243 | CL AZALEA: 15 parcelas, máx. nº 772, mejor ~529; municipio Catastro: ALCOBENDAS |
| 38041203 | Calle de la Virgen de los Rosales (Madrid) | sí | 233 | CL VIRGEN DE LOS ROSALES: 16 parcelas, máx. nº 92, mejor ~90; municipio Catastro: MADRID |

## Análisis

### Verificación de los exactos

No hay verdad de terreno: no se ha verificado en la Sede del Catastro y el anuncio no publica la RC. Solo se puede juzgar plausibilidad con los inmuebles de la dirección (`DNPLOC`):

- **111337066** (Consell de Cent 330, 3.ª, 230 m², 1900): **plausible**. Es el único inmueble de la planta 03 (261 m², +13 %) y el año coincide.
- **105996116** (Arturo Soria 161, ático sin planta, 312 m²): **dudoso**. Gana 02-A (353 m², +13 %) con `alta`, pero el anuncio es un ático y el Catastro tiene AT-A (230 m²) y AT-B (235 m²); el 312 puede incluir terraza. Probable falso `alta`.
- **109776242** (Valle de la Orotava 2, casa, 208 m², 2006): **indeterminado**. Cuatro chalés idénticos en cuatro parcelas (3 de 234 m²); gana el 1121903 (a 26 m) por orden, pero el punto exacto cae en el centroide del 1121905 (0 m), que tiene la misma puntuación.
- **104685725** (Mesena 80, 7.ª, 318 m² / 126 útiles, obra nueva): **no plausible**. 186 inmuebles en dos parcelas; 8 empatados en la 07 con 249 m² (−22 %), ninguno dentro de ±15 %. El punto "exacto" está a 193 m de la parcela más cercana de la dirección (¿oficina de ventas?).

### Conclusiones

1. Confianza: alta 2 (8 %) · media 12 (50 %) · baja 9 (38 %) · ninguna 1 (4 %). Sin errores de la API.
2. Empates: en 14 de 23 anuncios con candidatos, 1.º y 2.º puntúan igual (misma planta y m² en la escalera o edificios gemelos). La `media` resultante es engañosa.
3. Radio: con coords aproximadas, en 6 de 16 anuncios con planta el 1.º no está en esa planta: probablemente la finca real queda fuera de los ~25 m de `RCCOOR_Distancia`. En chalés el radio da 0–5 candidatos y a veces suelos o deportivos.
4. Desplazamiento: exactas mediana 14 m (salvo Mesena, 193 m); solo calle, cota inferior mediana 123 m, p95 236 m, máx. 243 m. El p95 real es ≥ 236 m.
5. **Radio recomendado para #30: 250 m** (WFS INSPIRE por BBOX; una rejilla de `RCCOOR` no escala a ese radio), filtrando por superficie ±15 % antes de pedir `DNPRC` y priorizando por distancia.
6. Año: el `ant` del Catastro difiere a menudo del anuncio (1957/1972, 1966/1984, 1985/1935): señal ruidosa.
7. Propuesta (sin aplicar, para specs/02):
   - `tipo: 'atico'` sin planta → planta `atico` (casa con `AT` o la planta más alta de la parcela).
   - Pesos: superficie 0,45 · planta 0,35 · año 0,10 (tolerancia ±5) · uso 0,10.
   - Desempate por distancia a la parcela cuando las coords son exactas (y como orden secundario siempre).
   - `media` exige además ventaja ≥ 0,1 o ≤ 3 empatados en cabeza; si no, `baja`.
   - Tolerancia de superficie: mantener ±15 % (cubre al 1.º en 19 de 23); en obra nueva no hay base para ampliarla.
   - Vías: probar también la variante castellana ("Sant Vicent Màrtir" no existe en el Catastro de València).
