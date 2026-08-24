import { test, expect } from '@playwright/test'

/**
 * Fluxo único ponta a ponta (SPRINT-0 §13): visitante tenta /inicio, é mandado
 * ao login, autentica, chega ao destino, abre o menu do perfil, sai, e o
 * retorno a /inicio exige login de novo.
 *
 * Requer credenciais reais; sem elas, o teste é pulado.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD para rodar')

test('login, navegação e logout', async ({ page }) => {
  // Sem sessão, /inicio manda ao login preservando o destino.
  await page.goto('/inicio')
  await expect(page).toHaveURL(/\/login\?next=%2Finicio/)

  // Autentica.
  await page.getByLabel('E-mail').fill(email!)
  await page.getByLabel('Senha').fill(password!)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Chega ao destino original.
  await expect(page).toHaveURL(/\/inicio$/)

  // Abre o menu do perfil e sai.
  await page.getByRole('button', { name: /./ }).last().click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)

  // O retorno a /inicio exige login de novo.
  await page.goto('/inicio')
  await expect(page).toHaveURL(/\/login/)
})
