# 06 · Panel

Side Panel de Chrome que muestra el resultado del anuncio de la pestaña activa.

## Estados
- No es un anuncio soportado → mensaje breve.
- Cargando.
- Sin candidatos → pedir número de portal o RC.
- Resultado.

## Secciones del resultado
1. **Inmueble**: RC, dirección, confianza; selector de candidatos y campo para pegar RC.
2. **Discrepancias**: primero avisos, luego revisar, luego ok.
3. **Alertas** del texto.
4. **Gastos de compra**.
5. **Siguientes pasos**: enlaces a la Sede del Catastro (con la RC) y a pedir nota simple (registradores.org).

## Criterios
- [ ] Se actualiza al cambiar de pestaña o de anuncio.
- [ ] Cada dato indica su fuente.
- [ ] Usable a 360 px de ancho; tema claro y oscuro.
- [ ] Sin peticiones a servidores distintos de Catastro.
