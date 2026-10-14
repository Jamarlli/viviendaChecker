import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // Una sola extensión, y el Catastro real no admite ráfagas.
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? 'github' : 'list',
})
