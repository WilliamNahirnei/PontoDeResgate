import { test, expect } from '../fixtures/auth'

test.describe('Login', () => {
  test('login válido redireciona para o painel', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('admin@pontoderesgate.local')
    await page.getByLabel('Senha').fill('password')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/painel$/)
  })

  test('login inválido mostra mensagem de erro', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('admin@pontoderesgate.local')
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('acesso ao painel sem sessão redireciona para o login', async ({ page }) => {
    await page.goto('/painel')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('sessão de admin master acessa o painel diretamente', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')

    await expect(page).not.toHaveURL(/\/login$/)
  })
})
