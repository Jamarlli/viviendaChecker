# viviendaChecker

Extensión de navegador **open source** que contrasta los anuncios de portales inmobiliarios (Idealista, Fotocasa, Pisos.com, Habitaclia…) con los datos oficiales del **Catastro** y muestra las discrepancias y la información relevante que el anuncio no menciona.

> Estado: fase de diseño. Todavía no hay código.

## Objetivos

- **Emparejar** cada anuncio con su referencia catastral (por dirección o coordenadas), mostrando candidatos y un **nivel de confianza**; el usuario puede corregir la selección (planta/puerta).
- **Detectar discrepancias**: superficie, año de construcción, uso (p. ej. local anunciado como vivienda), trastero/garaje con referencia propia, parcela en chalets.
- **Mostrar datos no mencionados**: gastos de compra estimados (ITP, notaría…), precio/m² frente a la zona, certificado energético, zona inundable, licencias turísticas.
- **Cargas**: ayudar a pedir la nota simple en el Registro de la Propiedad (la paga el usuario directamente; sin intermediación).

## Principios

- **Coste cero de uso**: solo fuentes públicas y gratuitas (servicios OVC e INSPIRE del Catastro, datos abiertos de Notariado/INE/MITMA). Sin APIs de pago por uso.
- **Sin servidor** en lo posible: las consultas salen del navegador del usuario.
- **Privacidad**: sin cuentas ni telemetría; no se almacena ni redistribuye el contenido de los anuncios.

## Stack previsto

- Manifest V3 + TypeScript con [WXT](https://wxt.dev/)
- UI en el Side Panel de Chrome
- Un adaptador por portal para extraer los datos del anuncio
- Service worker para las llamadas al Catastro

## Herramientas existentes

| Funcionalidad | Hogarfax | PrecioReal | Precios Inm. Plus | idealista/maps | casascan | catastro-lib-python |
|---|---|---|---|---|---|---|
| Tipo | Extensión | Extensión | Extensión | Web | Script Python | Librería |
| Empareja anuncio → referencia catastral | ✅ | ✅ | ❌ | ❌ (manual) | ❌ | ❌ |
| Indica confianza del emparejamiento | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Compara superficie / año / uso | ✅ / ❓ / ❓ | ✅ / ✅ / ✅ | ❌ | ❌ | ❌ | ❌ |
| Cargas / nota simple | ❌ | ❌ | ❌ | ❌ | ½ | ❌ |
| Energía / inundabilidad / turísticos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Open source | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Coste | Gratis + informe 24,90 € | Freemium, desde 14,99 €/mes | Gratis | Gratis | Gratis | Gratis |

Datos tomados de las webs y fichas de cada producto (octubre 2026), sin verificación independiente.

## Licencia

[GPL-3.0](LICENSE)
