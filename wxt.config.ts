import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'viviendaChecker',
    description: 'Contrasta anuncios de Idealista con el Catastro',
    action: {},
    permissions: ['sidePanel', 'storage'],
    host_permissions: ['https://www.idealista.com/*', 'https://ovc.catastro.meh.es/*'],
  },
})
