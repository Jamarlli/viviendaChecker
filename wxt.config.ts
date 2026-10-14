import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  manifest: ({ mode }) => ({
    name: 'viviendaChecker',
    description: 'Contrasta anuncios de Idealista con el Catastro',
    action: {},
    // `tabs` solo en el build de E2E: localizar la pestaña del anuncio por URL.
    permissions: ['sidePanel', 'storage', ...(mode === 'e2e' ? ['tabs'] : [])],
    // El content script se inyecta por `matches`; no hace falta permiso de host en Idealista.
    host_permissions: ['https://ovc.catastro.meh.es/*'],
  }),
})
