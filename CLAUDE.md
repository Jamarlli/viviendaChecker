# viviendaChecker

Extensión de Chrome (MV3) que contrasta anuncios de Idealista con el Catastro. Open source (GPL-3.0), coste de uso cero, sin servidor.

## Estilo
Escueto en código, comentarios y textos. Comentarios solo si explican un porqué. Código e identificadores en español (dominio), salvo términos técnicos.

## Método: SDD + TDD
1. La spec (`specs/`) manda. Si falta o es ambigua, no inventes: anótalo en la issue.
2. Cada criterio de la spec → test (Vitest) antes del código.
3. Rojo → código mínimo → verde → refactor.
4. Si descubres algo que cambia la spec, actualízala en la misma PR.

## Arquitectura (hexagonal)
- `src/core/`: lógica pura. Sin APIs de navegador ni red. Recibe dependencias por parámetro.
- `src/adapters/portales/<portal>/`: HTML → `Anuncio`.
- `src/adapters/catastro/`: API OVC → `Inmueble`.
- `src/entrypoints/`: content script, background, sidepanel (WXT).
- `fixtures/`: HTML y respuestas reales grabadas. Los tests nunca llaman a la red.
- `data/`: tablas estáticas (impuestos…).

## Flujo de trabajo
- Una issue → una rama `<etiqueta>/<n>-<slug>` → una PR con `Closes #n`.
- Nunca push a `main` (protegida). Merge solo squash, con CI en verde.
- Antes de abrir PR: `npm run check` en verde.
- Commits y PR en español, cortos.

## Comandos
- `npm run dev`: extensión en modo desarrollo.
- `npm test`: tests.
- `npm run check`: lint + typecheck + tests.
- `npm run build`: build de producción.

## Catastro (OVC, JSON, sin clave)
Base: `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/`
- `COVCCallejero.svc/json/Consulta_DNPLOC?Provincia=&Municipio=&Sigla=&Calle=&Numero=`
- `COVCCoordenadas.svc/json/Consulta_RCCOOR_Distancia?CoorX=<lon>&CoorY=<lat>&SRS=EPSG:4326`
- `COVCCallejero.svc/json/Consulta_DNPRC?RefCat=<14 o 20 car.>`
