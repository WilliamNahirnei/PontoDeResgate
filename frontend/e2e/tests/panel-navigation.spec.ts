import { test, expect } from '../fixtures/auth'

const ADMIN_PATHS = ['/painel/operadores', '/painel/operadores/novo', '/painel/logs']

// Roda depois do init script da fixture (a ordem de registro vale) e troca o
// papel guardado no navegador, como um operador que edita o localStorage.
async function forgeAdminRole(page) {
  await page.addInitScript(() => {
    const user = JSON.parse(window.localStorage.getItem('pontoderesgate.user') ?? 'null')
    if (user) {
      window.localStorage.setItem('pontoderesgate.user', JSON.stringify({ ...user, role: 'admin_master' }))
    }
  })
}

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

  test('operador que altera o papel guardado no navegador para admin master não vê os itens de menu de gestão de operadores nem de logs', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    await forgeAdminRole(page)
    await page.goto('/painel')

    // Espera a barra de navegação estar desenhada, como no teste do operador comum.
    await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Operadores' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Logs' })).toHaveCount(0)
  })

  test('operador que altera o papel guardado no navegador para admin master e acessa direto as telas de admin é levado ao painel', async ({
    page,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    await forgeAdminRole(page)

    for (const path of ADMIN_PATHS) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/painel$/)
      await expect(page.getByRole('heading', { name: 'Operadores' }), path).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Logs de operações' }), path).toHaveCount(0)
      await expect(page.getByText('Novo operador'), path).toHaveCount(0)
    }
  })

  test('admin master que recarrega uma tela de admin continua nela e vê os itens de menu de admin master', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()

    for (const path of ADMIN_PATHS) {
      await page.goto(path)
      await page.reload()
      await expect(page, path).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('link', { name: 'Operadores' }), path).toBeVisible()
      await expect(page.getByRole('link', { name: 'Logs' }), path).toBeVisible()
    }
  })
})
