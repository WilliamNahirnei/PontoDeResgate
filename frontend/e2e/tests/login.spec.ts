import { test, expect } from '../fixtures/auth'
import { adminMasterToken, createOperator } from '../fixtures/operators'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

async function loginThroughForm(page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function expectNoStoredSession(page) {
  expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))).toBeNull()
  expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.user'))).toBeNull()
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

  test('login com senha errada mostra mensagem de erro e não guarda sessão', async ({ page }) => {
    await loginThroughForm(page, 'admin@pontoderesgate.local', 'senha-errada')

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expectNoStoredSession(page)
  })

  test('login com e-mail inexistente mostra a mesma mensagem de erro e não guarda sessão', async ({ page }) => {
    await loginThroughForm(page, `inexistente.${Date.now()}@pontoderesgate.local`, 'senha-qualquer-123')

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expectNoStoredSession(page)
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
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()

    // Não navega de novo para /painel aqui: o loginAsAdminMaster injeta a
    // sessão via addInitScript, que roda a cada novo carregamento de
    // documento na página — uma segunda navegação reinjetaria o token e
    // mascararia o logout. Basta confirmar que o storage foi limpo.
    await expectNoStoredSession(page)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)
    // Sair por vontade própria não é recusa de autenticação: sem alerta de sessão expirada.
    await expect(page.getByText('Sua sessão expirou. Faça login novamente.')).toHaveCount(0)
  })

  // Um teste por rota: se uma falhar, o relatório diz qual.
  for (const path of ['/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
    test(`visitante sem sessão que acessa direto ${path} é levado ao login`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(/\/login$/)
    })
  }

  test('operador desativado pelo admin master não consegue entrar pela tela de login', async ({ page, request }) => {
    const operator = await createOperator(request)
    const deactivation = await request.post(`${API_BASE_URL}/api/operators/${operator.id}/deactivate`, {
      headers: { Authorization: `Bearer ${await adminMasterToken(request)}` },
    })
    expect(deactivation.ok()).toBeTruthy()

    await loginThroughForm(page, operator.email, operator.password)

    // Mensagem genérica de propósito: dizer "desativado" confirmaria a quem
    // descobriu um e-mail e senha que as credenciais estão certas.
    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page.getByText(/desativ/i)).toHaveCount(0)
    await expect(page).toHaveURL(/\/login$/)
    await expectNoStoredSession(page)
  })

  test('operador reativado volta a conseguir entrar pela tela de login', async ({ page, request }) => {
    const operator = await createOperator(request)
    const headers = { Authorization: `Bearer ${await adminMasterToken(request)}` }
    const deactivation = await request.post(`${API_BASE_URL}/api/operators/${operator.id}/deactivate`, { headers })
    expect(deactivation.ok()).toBeTruthy()

    // Ainda desativado: a recusa é o ponto de partida, para provar que a
    // reativação é o que muda o resultado com as mesmas credenciais.
    await loginThroughForm(page, operator.email, operator.password)
    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    // A reativação é feita por API: o clique no botão pertence a outro cenário.
    const activation = await request.post(`${API_BASE_URL}/api/operators/${operator.id}/activate`, { headers })
    expect(activation.ok()).toBeTruthy()

    // Mesma página, sem recarregar: preenche o formulário de novo.
    await page.getByLabel('E-mail').fill(operator.email)
    await page.getByLabel('Senha').fill(operator.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByText(operator.name)).toBeVisible()
    // Espera a barra estar desenhada antes de afirmar a ausência dos links de admin master.
    await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Operadores' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Logs' })).toHaveCount(0)
    expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))).toBeTruthy()
    expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.user'))).toBeTruthy()
  })

  test('depois do logout, voltar no navegador não reabre o painel', async ({ page, request }) => {
    // Login pela tela, e não pela fixture: a fixture reinjeta o token a cada
    // carregamento de documento e mascararia o logout na navegação para trás.
    const operator = await createOperator(request)
    await loginThroughForm(page, operator.email, operator.password)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    // A URL antes e depois do goBack é a mesma (/login); sem isto, um goBack
    // que não saísse do lugar passaria. A entrada anterior do histórico é o painel.
    expect(await page.evaluate(() => window.history.state?.back)).toBe('/painel')

    const apiRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/')) apiRequests.push(req.url())
    })

    await page.goBack()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)
    await expectNoStoredSession(page)
    expect(apiRequests.filter((url) => url.includes('/api/rescue-requests'))).toEqual([])
  })

  test('recarregar a página com o painel aberto mantém a sessão do operador', async ({ page, request }) => {
    const operator = await createOperator(request)
    await loginThroughForm(page, operator.email, operator.password)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    const tokenBeforeReload = await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))
    expect(tokenBeforeReload).toBeTruthy()

    // O nome na barra vem do localStorage e não prova sessão válida; quem prova
    // é a lista de pedidos voltar 200 com o token depois do reload.
    const [listResponse] = await Promise.all([
      page.waitForResponse((res) => new URL(res.url()).pathname === '/api/rescue-requests' && res.request().method() === 'GET'),
      page.reload(),
    ])

    expect(listResponse.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByText(operator.name)).toBeVisible()
    await expect(page).toHaveURL(/\/painel$/)
    expect(await page.evaluate(() => window.localStorage.getItem('pontoderesgate.token'))).toBe(tokenBeforeReload)
    await expect(page.getByText('Sua sessão expirou. Faça login novamente.')).toHaveCount(0)
  })
})
