# 02 · Emparejamiento con Catastro

Dado un `Anuncio`, encuentra los inmuebles catastrales candidatos y su confianza.

## Modelo
```ts
Inmueble { rc: string; uso: string; m2: number; anio: number; planta: string; puerta: string; direccion: string }
Candidato { inmueble: Inmueble; puntuacion: number /* 0-1 */ }
Emparejamiento { candidatos: Candidato[]; confianza: 'alta' | 'media' | 'baja' | 'ninguna'; origen: 'direccion' | 'coords' | 'manual' }
```

## Flujo
1. Parcelas: con vía + número → `DNPLOC`; si no, con coords → `RCCOOR_Distancia`; si no → `ninguna`.
2. Inmuebles de cada parcela → `DNPRC`.
3. Puntuar cada inmueble y ordenar.

## Puntuación
| Señal | Peso |
|---|---|
| Superficie construida (o útil × 1,2) dentro de ±15 % | 0,45 |
| Planta coincide | 0,30 |
| Año ±2 | 0,15 |
| Uso residencial | 0,10 |

Las señales sin dato en el anuncio no puntúan ni penalizan (se normaliza sobre los pesos disponibles).
- Límites inclusivos (±15 % y ±2 años incluidos).
- Si hay construida y útil, se usa la construida.
- El uso se evalúa siempre: todo anuncio ofrece vivienda.
- Planta: ambos lados se normalizan con `core/planta.ts` a las formas canónicas de la spec 01. Catastro: `BJ`/`00`/`0` → `bajo`, `EN` → `entreplanta`, `AT` → `atico`, `SS`/`ST`/negativas → `sotano`, `01` → `1`, `OD` y desconocidas → `otro`. Si el anuncio queda en `otro`, la señal no se evalúa.

## Confianza
- `alta`: 1.º ≥ 0,8 y ventaja ≥ 0,2 sobre el 2.º (sin 2.º, ventaja total). Con coords aproximadas, como máximo `media`.
- `media`: 1.º ≥ 0,6.
- `baja`: resto.
- `ninguna`: sin candidatos.

## Criterios
- [ ] Con dirección exacta y datos completos → `alta` y RC correcta (fixtures).
- [ ] Sin número pero con coords → candidatos de parcelas cercanas.
- [ ] Coords aproximadas → nunca `alta`.
- [ ] Inmuebles no residenciales se puntúan, no se descartan (para detectar "local como vivienda").
- [ ] El usuario puede elegir otro candidato o pegar una RC; se guarda por id de anuncio y tiene prioridad (`origen: 'manual'`).
- [ ] Error o caída del Catastro → mensaje claro, sin romper el panel.
- [ ] Provincias forales → "no soportado".

## Cliente Catastro (`adapters/catastro`)
Devuelve `Resultado<T>` (`ok`/`error`), nunca lanza. Errores: `noSoportado` · `sinResultados` (cód. OVC 5 y 43, o lista vacía) · `api` (otro código o JSON inválido) · `red` (fallo de fetch o HTTP no 2xx).

Formato real (fixtures en `fixtures/catastro/`):
- Varios inmuebles → `lrcdnp.rcdnp[]`; uno solo → objeto `bico.bi`. Se normalizan a lista.
- `Sigla` es obligatoria: vacía → "no existe ningún inmueble".
- Número inexistente → error 43 con `numerero` (números cercanos); se ignoran.
- `RCCOOR_Distancia` devuelve parcelas (14 car.) con `dis` en metros; en forales, lista vacía.
- Sin `ant` (solares) → `anio: 0`. `pt`/`pu` se copian tal cual (`00`, `-1`, `OD`…).

## Dudas
- Pesos y umbrales iniciales; se ajustan con 20+ anuncios reales.
- `sfc` del Catastro incluye zonas comunes; validar con fixtures.
