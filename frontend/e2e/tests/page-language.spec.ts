import { test, expect } from '../fixtures/auth'

// REQUISITOS.md §1.1: o navegador reconhece as telas como escritas em português.
test.describe('Idioma das telas', () => {
  test('todas as telas são reconhecidas pelo navegador como escritas em português', async ({
    page,
    loginAsAdminMaster,
  }) => {
    for (const path of ['/', '/login']) {
      await page.goto(path)
      await expect(page.locator('html'), path).toHaveAttribute('lang', /^pt/)
    }

    await loginAsAdminMaster()
    for (const path of ['/painel', '/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
      await page.goto(path)
      await expect(page.locator('html'), path).toHaveAttribute('lang', /^pt/)
    }
  })
})
