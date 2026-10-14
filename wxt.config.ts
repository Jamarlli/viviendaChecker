import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'viviendaChecker',
    description: 'Contrasta anuncios de Idealista con el Catastro',
    action: {},
    permissions: ['sidePanel', 'storage'],
    // El content script se inyecta por `matches`; no hace falta permiso de host en Idealista.
    host_permissions: ['https://ovc.catastro.meh.es/*'],
  },
})
