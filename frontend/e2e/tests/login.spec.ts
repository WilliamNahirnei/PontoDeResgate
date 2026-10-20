import { test, expect } from '../fixtures/auth'
import { adminMasterToken, createOperator } from '../fixtures/operators'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

async function loginThroughForm(page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('Login', () => {
  test('login válido de operador comum redireciona para o painel, sem os itens de admin master', async ({
    page,
    request,
  }) => {
    const operator = await createOperator(request)

    await loginThroughForm(page, operator.email, operator.password)

    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByText(operator.name)).toBeVisible()
    // Espera a barra do painel estar desenhada (link "Painel") antes de afirmar a
    // ausência dos links de admin master, senão a checagem passa antes da hora.
    await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Operadores' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Logs' })).toHaveCount(0)
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

  test('admin master entra pela tela de login, sem nenhum dado de sessão antes, e vê o painel com os itens de admin master', async ({
    page,
    context,
  }) => {
    // Parte de um navegador sem nenhum dado de login: apaga cookies e armazenamento.
    await page.goto('/login')
    await context.clearCookies()
    await page.evaluate(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
    await page.reload()
    // O modo dev do Vue recria chaves do Devtools no localStorage; só as de sessão importam.
    expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))).toBeNull()
    expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.user'))).toBeNull()

    await page.getByLabel('E-mail').fill('admin@pontoderesgate.local')
    await page.getByLabel('Senha').fill('password')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    // O nome do admin master semeado é "Admin Master"; os links de Operadores e
    // Logs são exclusivos desse papel.
    await expect(page.getByText('Admin Master', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Operadores' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Logs' })).toBeVisible()
  })

  test('logout pela UI encerra a sessão e redireciona ao login', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')

    await page.getByRole('button', { name: 'Sair' }).click()

    await expect(page).toHaveURL(/\/login$/)

    // Não navega de novo para /painel aqui: o loginAsAdminMaster injeta a
    // sessão via addInitScript, que roda a cada novo carregamento de
    // documento na página — uma segunda navegação reinjetaria o token e
    // mascararia o logout. Basta confirmar que o storage foi limpo.
    const remainingToken = await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))
    expect(remainingToken).toBeNull()
  })

  test('visitante sem sessão que acessa direto as telas de admin master é levado ao login', async ({ page }) => {
    for (const path of ['/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
      await page.goto(path)

      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    }
  })

  test('operador desativado pelo admin master não consegue entrar pela tela de login', async ({ page, request }) => {
    const operator = await createOperator(request)
    await request.post(`${API_BASE_URL}/api/operators/${operator.id}/deactivate`, {
      headers: { Authorization: `Bearer ${await adminMasterToken(request)}` },
    })

    await loginThroughForm(page, operator.email, operator.password)

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('operador reativado volta a conseguir entrar pela tela de login', async ({ page, request }) => {
    const operator = await createOperator(request)
    const adminToken = await adminMasterToken(request)
    await request.post(`${API_BASE_URL}/api/operators/${operator.id}/deactivate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    await request.post(`${API_BASE_URL}/api/operators/${operator.id}/activate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    await loginThroughForm(page, operator.email, operator.password)

    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page).toHaveURL(/\/painel$/)
  })

  test('depois do logout, voltar no navegador não reabre o painel', async ({ page, request }) => {
    // Login pela tela, e não pela fixture: a fixture reinjeta o token a cada
    // carregamento de documento e mascararia o logout na navegação para trás.
    const operator = await createOperator(request)
    await loginThroughForm(page, operator.email, operator.password)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goBack()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)
  })

  test('recarregar a página com o painel aberto mantém a sessão do operador', async ({ page, request }) => {
    const operator = await createOperator(request)
    await loginThroughForm(page, operator.email, operator.password)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByText(operator.name)).toBeVisible()
    await expect(page).toHaveURL(/\/painel$/)
  })
})
