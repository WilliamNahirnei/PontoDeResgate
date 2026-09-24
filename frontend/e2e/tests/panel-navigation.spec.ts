import { test, expect } from '../fixtures/auth'

test.describe('Navegação do painel por papel', () => {
  test('admin master vê os itens de menu de gestão de operadores e de logs', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')

    await expect(page.getByRole('link', { name: 'Operadores' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Logs' })).toBeVisible()
  })

  test('operador comum não vê os itens de menu de gestão de operadores nem de logs', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    await page.goto('/painel')

    // Espera a barra de navegação estar desenhada: sem isso, o toHaveCount(0)
    // abaixo passa antes de os itens aparecerem, até para o admin master.
    await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Operadores' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Logs' })).toHaveCount(0)
  })

  test('operador comum é redirecionado ao painel se acessar diretamente a gestão de operadores ou os logs', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()

    await page.goto('/painel/operadores')
    await expect(page).toHaveURL(/\/painel$/)

    await page.goto('/painel/logs')
    await expect(page).toHaveURL(/\/painel$/)
  })
})
