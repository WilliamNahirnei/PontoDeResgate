import { test, expect } from '../fixtures/auth'

// REQUISITOS.md §1.2: um endereço inexistente leva à tela pública de pedido
// (sem sessão) ou ao painel (com sessão), nunca a uma tela em branco.
async function expectPublicRequestScreen(page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Pedido de socorro' })).toBeVisible()
}

async function expectPanel(page) {
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
}

test.describe('Endereço inexistente', () => {
  test('sem sessão, um endereço inexistente fora da área do operador leva à tela de pedido de socorro', async ({
    page,
  }) => {
    await page.goto('/nao-existe')

    await expectPublicRequestScreen(page)
  })

  test('sem sessão, um endereço inexistente dentro da área do operador leva à tela de pedido de socorro, não ao login', async ({
    page,
  }) => {
    await page.goto('/painel/nao-existe')

    await expectPublicRequestScreen(page)
    await expect(page.locator('a[href*="painel"], a[href*="login"]')).toHaveCount(0)
    await expect(page.getByText(/painel|entrar|login|operador/i)).toHaveCount(0)
  })

  test('operador logado num endereço inexistente fora da área do operador é levado ao painel', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    await page.goto('/nao-existe')

    await expectPanel(page)
  })

  test('operador logado num endereço inexistente dentro da área do operador é levado ao painel', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    await page.goto('/painel/nao-existe')

    await expectPanel(page)
  })

  test('admin master logado num endereço inexistente, fora ou dentro da área do operador, é levado ao painel', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()

    for (const path of ['/nao-existe', '/painel/nao-existe']) {
      await page.goto(path)
      await expectPanel(page)
    }
  })
})
