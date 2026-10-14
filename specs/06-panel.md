# 06 · Panel

Side Panel de Chrome que muestra el resultado del anuncio de la pestaña activa.

## Flujo
1. Content script: `extraerAnuncio` → mensaje al background (también `null` si no es un anuncio).
2. Background: `emparejar` + `discrepancias` + `detectarAlertas` + `calcularGastos`; guarda el estado por pestaña y lo envía al panel. El último anuncio de cada pestaña se guarda en `storage.session` para rehacer el análisis si el service worker se reinicia.
3. Panel: pinta el estado. Las acciones (confirmar, buscar números, pegar RC) van al background.

## Estados
- **No soportado**: no es un anuncio de Idealista → mensaje breve.
- **Cargando**.
- **Error**: Catastro caído, error de la API o provincia foral → mensaje claro; alertas y gastos se muestran igual.
- **Sin candidatos** → buscar por calle y número, o pegar RC.
- **Resultado**.

## Inmueble: candidatos y confirmación (tipo Hogarfax)
- Nunca se presenta un emparejamiento no confirmado como seguro: se muestra el candidato más probable con su confianza y la etiqueta "Sin confirmar". Solo `origen: 'manual'` se muestra como "Confirmado por ti".
- Lista de candidatos (máx. 10): planta, puerta, m², uso, año y botón "Es este". Confirmar guarda la RC (`guardarSeleccion`, `Almacen` sobre `chrome.storage.local`) y rehace el análisis.
- Búsqueda guiada: calle (prefijada con la del anuncio) y número → números de la vía → elegir número → inmuebles de esa parcela (ordenados por puntuación) → elegir planta/puerta → confirmar. Solo si el anuncio trae provincia y municipio.
- Alternativa: pegar RC (20 car.). RC no válida → aviso, no se guarda.
- Discrepancias contra el candidato mostrado; si no está confirmado, se indica.

### Números de una vía (`ObtenerNumerero`)
Verificado con la API: ninguna consulta devuelve todos los números de una vía.
- `COVCCallejero.svc/json/ObtenerNumerero?Provincia=&Municipio=&TipoVia=&NomVia=&Numero=`.
- Número existente → ese número y su parcela (`nump[]`, a veces duplicado con `plp: " "`).
- Número inexistente → error 43 con hasta 15 números cercanos en `nump`; se tratan como resultado. Sin cercanos → `sinResultados`.
- `Numero` vacío → error 41; sin número se consulta `0` (primeros números de la vía).
- `lerr` llega como `{ err: [...] }` (en `DNPLOC`, como lista).
- Cliente: `buscarNumeros(l: Localizacion): Resultado<NumeroVia[]>`, `NumeroVia { numero; pc }`, sin duplicados.

## Secciones del resultado
1. **Inmueble**: RC, dirección, confianza, "Sin confirmar"/"Confirmado por ti"; candidatos, búsqueda guiada y pegar RC.
2. **Discrepancias**: primero avisos, luego revisar, luego ok. Con `pocoFiable`, "emparejamiento poco fiable".
3. **Alertas** del texto, con la frase que la activa.
4. **Gastos de compra**: desglose, total y la nota fija (`NOTA_GASTOS`).
5. **Siguientes pasos**: Sede del Catastro con la RC y nota simple (sede.registradores.org).

## Criterios
- [ ] Se actualiza al cambiar de pestaña o de anuncio.
- [ ] Cada dato indica su fuente (anuncio, Catastro, estimación).
- [ ] Ningún candidato sin confirmar se muestra como seguro.
- [ ] La confirmación persiste por id de anuncio.
- [ ] Usable a 360 px de ancho; tema claro y oscuro (`prefers-color-scheme`); accesible (etiquetas, foco, `aria-live`).
- [ ] Sin peticiones a servidores distintos de Catastro.
