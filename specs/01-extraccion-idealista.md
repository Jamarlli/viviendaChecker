# 01 · Extracción del anuncio (Idealista)

Convierte la página de un anuncio de Idealista en un `Anuncio`.

## Modelo
```ts
Anuncio {
  portal: 'idealista'; id: string; url: string
  precio?: number
  tipo?: 'piso' | 'atico' | 'duplex' | 'estudio' | 'casa' | 'otro'
  obraNueva: boolean
  direccion?: { via?: string; numero?: string }
  municipio?: string; provincia?: string
  coords?: { lat: number; lon: number; aproximada: boolean }
  planta?: string            // normalizada (core/planta.ts): 'bajo' | 'entreplanta' | 'atico' | 'sotano' | '1' | '2'… | 'otro'; semisótano → 'sotano'
  m2Construidos?: number; m2Utiles?: number
  anio?: number
  descripcion: string
  mencionaTrastero: boolean; mencionaGaraje: boolean
}
```

## Criterios
- [ ] URL `idealista.com/inmueble/{id}/` → se extrae; otras URLs → `null`.
- [ ] Extrae cada campo presente; los ausentes quedan `undefined`, sin fallar.
- [ ] Parsea "90 m² construidos, 75 m² útiles", "Planta 3ª exterior", "Bajo", "Construido en 1975".
- [ ] Marca `coords.aproximada` cuando el portal indica ubicación aproximada.
- [ ] Cada caso se prueba con un HTML real guardado en `fixtures/idealista/`.

## Dónde está cada dato
Estudiado sobre 24 anuncios reales (oct. 2026): pisos, áticos, dúplex, estudio, chalets, obra nueva, ocupados, nuda propiedad, alquilados; Madrid, Barcelona, Valencia y Sevilla. Todo está en el HTML servido, sin esperar a JS.

| Campo | Dónde | Notas |
|---|---|---|
| `id`, `url` | `link[rel=canonical]` → `https://www.idealista.com/inmueble/{id}/` | También `config.propertyId`. |
| `precio` | `div.info-data .info-data-price` ("990.000 €") | Respaldo: `idForm.buyingPrice` en el script `var config`. Con rebaja, el precio anterior va aparte en `.pricedown_price`: ignorarlo. |
| `tipo` | Inicio de `.main-info__title-main` ("Ático en venta en …") | Piso → `piso`, Ático → `atico`, Dúplex → `duplex`, Estudio → `estudio`, Chalet…/Casa o chalet… → `casa`; resto → `otro`. `strong.typology` solo distingue piso/chalet. |
| `obraNueva` | `.info-features` contiene "Obra nueva" o "Características básicas" contiene "Promoción de obra nueva" | |
| `direccion` | Primer `li.header-map-list` de `#headerMap`, solo si la lista tiene 3 o más elementos (los 2 últimos son siempre municipio y "zona, provincia") y ese primero no empieza por "Barrio " ni "Distrito " | "Calle de Mesena, 80" → `{via, numero}`; sin coma-número (o ", s/n") → solo `via`. Formato libre ("CL Valle De La Orotava, 2"). |
| `municipio` | Penúltimo `li.header-map-list` | Ojo: en urbanizaciones es la zona de Idealista, no el municipio ("La Moraleja", "Ciudalcampo"). |
| `provincia` | Último `li.header-map-list`, tras la última coma ("Madrid capital, Madrid") | Nombre local ("València"). Código INE en `idForm.locationId` ("0-EU-ES-28"). |
| `coords` | `config.multimediaCarrousel.map.src`: `staticmap?…&center={lat}%2C{lon}` | `mapConfig.latitude/longitude` llegan vacíos; no hay `data-` con coords. |
| `coords.aproximada` | `map.addressVisibility !== 'EXACT'` | Equivale a que exista `.no-show-address-feedback` ("Por privacidad, el anunciante no ha indicado la ubicación exacta del inmueble.") y a `mapConfig.markerVisible` ≠ 1. |
| `planta` | Sección "Edificio" de `.details-property`: "7ª planta exterior", "Bajo exterior" | Normalizar con `normalizarPlanta`. En chalets no hay sección "Edificio"; su "2 plantas" (en básicas) es nº de alturas, no planta. Algunos áticos solo dicen "exterior". |
| `m2Construidos`, `m2Utiles` | "Características básicas": "318 m² construidos, 126 m² útiles" | Útiles casi nunca. Ignorar "Parcela de 1.500 m²". |
| `anio` | "Características básicas": "Construido en 1972" | Ausente en obra nueva y en bastantes usados. |
| `descripcion` | Primer `.comment .adCommentsLanguage` fuera de `.new-dev-promo` | Obra nueva tiene un segundo `.comment` con la descripción de la promoción. `<br>` → salto de línea; `trim()` de espacios al principio y al final (no se trunca). Algunas descripciones ya llegan cortadas desde Idealista (p. ej. 110491789 acaba en "intermediac"): se conservan tal cual. |
| `mencionaTrastero`, `mencionaGaraje` | Regex `/trastero/i` y `/garaje\|parking\|aparcamiento/i` sobre "Características básicas", `.info-features` y descripción | Mención literal, sin interpretar negaciones ("la vivienda no dispone de plaza" cuenta). |

Otros datos útiles: "Situación de la vivienda" en `.details-property` y `.detail-info-tags` ("Ocupada ilegalmente", "Nuda propiedad", "Alquilada, con inquilinos").

### Fixtures
- `fixtures/idealista/<id>.html`: HTML mínimo generado con `node scripts/sanear-fixture.mjs <raw.html>…`. Conserva los nodos de la tabla y sustituye en la descripción y el título: anunciante, teléfonos, emails, webs, CIF, nº de registro, referencias internas, dirección de la oficina y año de fundación de la agencia. La canónica se reconstruye a partir del id.
- `fixtures/idealista/esperado/<id>.json`: `Anuncio` esperado (revisado a mano).
- Los HTML originales van en `fixtures/idealista/raw/` (ignorado por git).
