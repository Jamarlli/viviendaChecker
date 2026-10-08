# 00 · Producto

## Visión
Que un comprador particular, al ver un anuncio, sepa en segundos si lo que dice cuadra con el Catastro y qué no le están contando.

## Usuario
Comprador particular. Lenguaje sencillo, sin jerga. Avisos explicados, nunca acusatorios ("diferencia a revisar", no "mentira").

## Alcance MVP
- Portal: Idealista (escritorio).
- UI: Side Panel de Chrome.
- Funcionalidades:
  1. [Extracción del anuncio](01-extraccion-idealista.md)
  2. [Emparejamiento con Catastro](02-emparejamiento.md)
  3. [Discrepancias](03-discrepancias.md)
  4. [Gastos de compra](04-gastos-compra.md)
  5. [Alertas en el texto](05-alertas-texto.md)
  6. [Panel](06-panel.md)

## Fuera de alcance MVP
Otros portales · catastros forales (País Vasco, Navarra) · cargas automáticas · energía, inundabilidad, turísticos · precio/m² de zona · móvil · LLM.

## Principios
- Coste cero: solo APIs públicas gratuitas. Sin servidor propio.
- Privacidad: sin cuentas ni telemetría. Solo se guarda en local la selección manual del usuario.
- Honestidad: toda conclusión muestra su fuente y su nivel de confianza.

## Arquitectura
Hexagonal.
- `core/`: lógica pura (emparejamiento, discrepancias, gastos, alertas). Sin dependencias del navegador. TDD.
- `adapters/portales/idealista`: HTML → `Anuncio`. Tests con fixtures.
- `adapters/catastro`: API OVC → `Inmueble`. Tests con respuestas grabadas.
- `entrypoints/`: content script, service worker, side panel (WXT).

## Fuentes
- Catastro OVC (JSON, sin clave):
  - `Consulta_DNPLOC`: inmuebles por dirección.
  - `Consulta_RCCOOR_Distancia`: parcelas cercanas a unas coordenadas.
  - `Consulta_DNPRC`: inmuebles de una parcela o datos de una referencia.
