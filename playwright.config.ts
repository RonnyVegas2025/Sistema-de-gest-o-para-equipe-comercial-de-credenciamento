import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright para o fluxo ponta a ponta de autenticação. Requer o app rodando
 * e credenciais de teste (E2E_EMAIL, E2E_PASSWORD). Roda separado do CI de
 * unidade, via `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
