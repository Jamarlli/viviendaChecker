# 02 · Emparejamiento con Catastro

Dado un `Anuncio`, encuentra los inmuebles catastrales candidatos y su confianza.

## Modelo
```ts
Inmueble { rc: string; uso: string; m2: number; anio: number; planta: string; puerta: string; direccion: string }
Candidato { inmueble: Inmueble; puntuacion: number /* 0-1 */; distancia?: number /* m a la parcela, solo por coords */ }
Emparejamiento { candidatos: Candidato[]; confianza: 'alta' | 'media' | 'baja' | 'ninguna'; origen: 'direccion' | 'coords' | 'manual' | 'ninguno' }
```
`origen: 'ninguno'`: sin dirección completa ni coords; no se consultó el Catastro.

## Flujo
0. Selección manual guardada para el id del anuncio → `DNPRC` de esa RC; `origen: 'manual'`, confianza `alta`.
1. Parcelas: con vía + número (+ provincia y municipio) → `DNPLOC`; si no (o sin resultados), con coords → parcelas a ≤ 250 m (WFS INSPIRE); si el WFS falla (red, API, vacío o > 15 s) → `RCCOOR_Distancia` (~25 m); si no → `ninguna`.
2. Inmuebles de cada parcela → `DNPRC`. (`DNPLOC` ya trae los inmuebles con sus datos.) Por coords, solo las 25 parcelas más cercanas, como mucho 5 a la vez; la que falla se descarta. Si fallan todas las del WFS, se repite con `RCCOOR_Distancia`; solo es error si tampoco da inmuebles.
3. Por coords y con superficie en el anuncio, se quedan los inmuebles dentro de ±15 % (la misma regla que puntúa); si no queda ninguno, se puntúan todos.
4. Puntuar cada inmueble y ordenar: si el anuncio indica planta (o es ático sin planta → `atico`), primero los de esa planta (ninguno de otra queda por delante); luego por puntuación; a igual puntuación, por distancia a la parcela (sin distancia, al final).

- `emparejar(anuncio, { catastro, almacen }, signal?)` devuelve `Resultado<Emparejamiento>`; nunca lanza. `sinResultados` → `ninguna`; `noSoportado`, `red` y `api` → error. Con `signal` abortada no se degrada ni se lanzan más consultas; el panel aborta el análisis al cambiar de anuncio u olvidar la pestaña.
- `Sigla` y `Calle` salen de la vía del anuncio: "Calle de Alcalá" → `CL` `ALCALA`. Se quita el artículo tras el tipo (de, del, de la, d', de l', dels, de les, do, da, dos, das…); sin tipo reconocible → `CL`. Tipos en catalán, valenciano y gallego → sigla castellana (Carrer → `CL`, Avinguda → `AV`, Plaça/Praza → `PZ`, Passeig → `PS`, Travessera → `TR`, Camí/Camiño → `CM`); Rúa → `RU` (verificado con la API).
- Selección manual: RC de 20 car. (espacios y minúsculas se normalizan), guardada en local por id de anuncio.

## Puntuación
| Señal | Peso |
|---|---|
| Superficie construida (o útil × 1,2) dentro de ±15 % | 0,45 |
| Planta coincide | 0,35 |
| Año ±5 (> 10 resta 0,10) | 0,10 |
| Uso residencial | 0,10 |

Las señales sin dato en el anuncio no puntúan ni penalizan (se normaliza sobre los pesos disponibles). Puntuación = Σ pesos obtenidos (− los restados) / Σ pesos evaluados, mínimo 0.
- Límites inclusivos (±15 %, ±5 años; resta desde 11 años de diferencia). Año 0 en el Catastro (sin dato) → ni suma ni resta, pero su peso cuenta en el denominador.
- Ático (`tipo: 'atico'`) sin planta → planta `atico`.
- Si hay construida y útil, se usa la construida.
- El uso se evalúa siempre: todo anuncio ofrece vivienda.
- Planta: ambos lados se normalizan con `core/planta.ts` a las formas canónicas de la spec 01. Catastro: `BJ`/`00`/`0` → `bajo`, `EN` → `entreplanta`, `AT` → `atico`, `SS`/`ST`/negativas → `sotano`, `01` → `1`, `OD` y desconocidas → `otro`. Si el anuncio queda en `otro`, la señal no se evalúa.

## Confianza
1.º y 2.º según el orden del flujo (paso 4).
- `alta`: 1.º ≥ 0,8 y ventaja ≥ 0,2 sobre el 2.º (sin 2.º, ventaja total). La ventaja puede ser negativa (2.º de otra planta con más puntuación): entonces no hay `alta`. Con coords aproximadas, como máximo `media`.
- `media`: 1.º ≥ 0,6 y (ventaja ≥ 0,1 o ≤ 3 empatados en cabeza: los primeros con la misma puntuación que el 1.º, incluido).
- `baja`: resto.
- `ninguna`: sin candidatos.

## Criterios
- [ ] Con dirección exacta y datos completos → `alta` y RC correcta (fixtures).
- [ ] Sin número pero con coords → candidatos de parcelas a ≤ 250 m, las más cercanas primero.
- [ ] WFS caído → parcelas de `RCCOOR_Distancia`.
- [ ] Coords aproximadas → nunca `alta`.
- [ ] Inmuebles no residenciales se puntúan, no se descartan (para detectar "local como vivienda").
- [ ] El usuario puede elegir otro candidato o pegar una RC; se guarda por id de anuncio y tiene prioridad (`origen: 'manual'`).
- [ ] Error o caída del Catastro → mensaje claro, sin romper el panel.
- [ ] Provincias forales → "no soportado".
- [ ] Anuncio 111109550 (5.ª, 194 m², 1985): un 2.º de 176 m² y 1935 no queda por delante de los del 5.º.

## Cliente Catastro (`adapters/catastro`)
Devuelve `Resultado<T>` (`ok`/`error`), nunca lanza. Errores: `noSoportado` · `sinResultados` (cód. OVC 5, 33 y 43, o lista vacía) · `api` (otro código o JSON inválido) · `red` (fallo de fetch o HTTP no 2xx).

Formato real (fixtures en `fixtures/catastro/`):
- Varios inmuebles → `lrcdnp.rcdnp[]`; uno solo → objeto `bico.bi`. Se normalizan a lista.
- `Sigla` es obligatoria: vacía → "no existe ningún inmueble".
- Número inexistente → error 43 con `numerero` (números cercanos); se ignoran.
- `RCCOOR_Distancia` devuelve parcelas (14 car.) con `dis` en metros; en forales, lista vacía.
- `parcelasEnRadio(coords, radioM, provincia?)`: WFS INSPIRE `CadastralParcel`, `GetFeature` por BBOX (cuadrado de lado 2·radio, EPSG:4326, orden lat,lon). GML (ISO-8859-1, solo se leen campos ASCII): `nationalCadastralReference` (14 car.) y `referencePoint` (`gml:pos` lat lon). `distancia`: metros del punto a `referencePoint`; se quedan las de `distancia ≤ radioM`, ordenadas; `direccion` vacía. Se parsea con expresiones regulares: el service worker no tiene `DOMParser`. Sin parcelas → `ExceptionReport` "No records founded" → `sinResultados`; otra excepción → `api`. Sin respuesta en 15 s → `red` ("Tiempo agotado"). Todos los métodos aceptan un `AbortSignal` opcional.
- Coste medido (Madrid centro, 250 m): ~420 parcelas, ~0,9 MB, 9–11 s. Más de ~1 km² tarda > 1 min: no ampliar el radio sin medir. El WFS de edificios (`wfsBU`) trae superficie total y nº de viviendas del edificio (no del inmueble) y tarda ~45 s y 2 MB: no se usa.
- Sin `ant` (solares) → `anio: 0`. `pt`/`pu` se copian tal cual (`00`, `-1`, `OD`…).

## Dudas
- Pesos y umbrales ajustados con 24 anuncios reales (#33, `docs/medicion-emparejamiento.md`); revisar con más.
- `sfc` del Catastro incluye zonas comunes; validar con fixtures.
