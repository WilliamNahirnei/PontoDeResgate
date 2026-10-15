import { test, expect } from '../fixtures/auth'

// REQUISITOS.md §1.3: a aba mostra o mesmo título, "PontoDeResgate", em todas as telas.
test.describe('Título da aba', () => {
  test('todas as telas mostram o título PontoDeResgate na aba', async ({
    page,
    loginAsAdminMaster,
  }) => {
    for (const path of ['/', '/login']) {
      await page.goto(path)
      await expect(page, path).toHaveTitle('PontoDeResgate')
    }

    await loginAsAdminMaster()
    for (const path of ['/painel', '/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
      await page.goto(path)
      await expect(page, path).toHaveTitle('PontoDeResgate')
    }
  })
})
