import { test, expect, injectSession } from '../fixtures/auth'
import { adminMasterToken, createOperator, loginViaApi } from '../fixtures/operators'
import { createRescueRequest } from '../fixtures/rescue-requests'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.'

const TOKEN_STORAGE_KEY = 'pontoderesgate.token'
const USER_STORAGE_KEY = 'pontoderesgate.user'

// Abre o painel com a sessão de um operador novo e devolve o operador, para o
// teste poder desativá-lo com o painel já aberto.
async function openPanelAsNewOperator(page, request) {
  const operator = await createOperator(request)
  await injectSession(page, operator.token, operator.user)
  await page.goto('/painel')
  await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()

  return operator
}

async function deactivateOperator(request, operatorId: number) {
  const response = await request.post(`${API_BASE_URL}/api/operators/${operatorId}/deactivate`, {
    headers: { Authorization: `Bearer ${await adminMasterToken(request)}` },
  })
  expect(response.ok()).toBeTruthy()
}

// Faz o servidor recusar a autenticação de uma sessão do admin master: o token
// é revogado (logout pela API) antes de a página usá-lo.
async function revokedAdminMasterSession(request) {
  const { token, user } = await loginViaApi(request, 'admin@pontoderesgate.local', 'password')
  const logout = await request.post(`${API_BASE_URL}/api/logout`, { headers: { Authorization: `Bearer ${token}` } })
  expect(logout.ok()).toBeTruthy()

  return { token, user }
}

function storedSession(page) {
  return page.evaluate(
    ([tokenKey, userKey]) => ({
      token: window.localStorage.getItem(tokenKey),
      user: window.localStorage.getItem(userKey),
    }),
    [TOKEN_STORAGE_KEY, USER_STORAGE_KEY],
  )
}

test.describe('Sessão recusada', () => {
  test('operador desativado com o painel aberto é levado ao login quando a autenticação é recusada', async ({
    page,
    request,
  }) => {
    const operator = await openPanelAsNewOperator(page, request)
    await deactivateOperator(request, operator.id)

    // O redirecionamento só vale como prova se veio de uma recusa de autenticação
    // do servidor (401), e não de outro erro qualquer.
    const [refused] = await Promise.all([
      page.waitForResponse((res) => new URL(res.url()).pathname === '/api/rescue-requests' && res.request().method() === 'GET'),
      page.getByRole('button', { name: 'Atualizar' }).click(),
    ])
    expect(refused.status()).toBe(401)

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)
  })

  test('depois da recusa no painel, a tela de login mostra o alerta de sessão expirada', async ({ page, request }) => {
    const operator = await openPanelAsNewOperator(page, request)
    await deactivateOperator(request, operator.id)

    await page.getByRole('button', { name: 'Atualizar' }).click()

    // A espera por /login é só passo do roteiro; o redirecionamento é do USR-61.
    await expect(page).toHaveURL(/\/login$/)
    // Texto exato e como alerta (v-alert tem role="alert"): o requisito fixa a frase.
    const alert = page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' })
    await expect(alert).toBeVisible()
    await expect(alert).toHaveText(SESSION_EXPIRED_MESSAGE)
    // Quem foi levado ao login pela recusa não tentou entrar: sem erro de credenciais.
    await expect(page.getByText('E-mail ou senha inválidos.')).toHaveCount(0)
  })

  test('o alerta de sessão expirada continua visível até a pessoa fechá-lo', async ({ page, request }) => {
    // O relógio do navegador é controlado para provar que o alerta não some sozinho
    // sem esperar de verdade.
    await page.clock.install()
    const operator = await openPanelAsNewOperator(page, request)
    await deactivateOperator(request, operator.id)

    await page.getByRole('button', { name: 'Atualizar' }).click()
    const alert = page.getByRole('alert').filter({ hasText: SESSION_EXPIRED_MESSAGE })
    await expect(alert).toBeVisible()

    // Prova que o relógio controlado avançou: sem isto, "não some sozinho" passaria
    // mesmo que o fastForward não tivesse efeito na página.
    const before = await page.evaluate(() => Date.now())
    await page.clock.fastForward('05:00')
    const after = await page.evaluate(() => Date.now())
    expect(after - before).toBeGreaterThanOrEqual(5 * 60 * 1000)
    await expect(alert).toBeVisible()

    await alert.getByRole('button', { name: 'Fechar' }).click()
    await expect(alert).toHaveCount(0)
  })

  test('depois da recusa a sessão guardada no navegador é apagada', async ({ page, request }) => {
    // Entra pela tela de login, e não por injectSession: a injeção roda a cada
    // carregamento de documento e mascararia a limpeza no reload e no acesso direto.
    const operator = await createOperator(request)
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(operator.email)
    await page.getByLabel('Senha').fill(operator.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    expect((await storedSession(page)).token).toBeTruthy()
    await deactivateOperator(request, operator.id)

    await page.getByRole('button', { name: 'Atualizar' }).click()
    await expect(page).toHaveURL(/\/login$/)

    expect(await storedSession(page)).toEqual({ token: null, user: null })

    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)

    await page.goto('/painel')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toHaveCount(0)
  })

  test('admin master com a autenticação recusada em uma tela de admin é levado ao login com o alerta', async ({
    page,
    request,
  }) => {
    for (const path of ['/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
      const { token, user } = await revokedAdminMasterSession(request)
      // Cada volta injeta o seu token; o script da última volta roda por último e prevalece.
      await injectSession(page, token, user)

      // Ao entrar direto na tela, a guarda confirma a sessão em GET /api/me: é essa
      // chamada que o servidor recusa com 401 e leva ao login.
      const [refused] = await Promise.all([
        page.waitForResponse((res) => new URL(res.url()).pathname === '/api/me' && res.request().method() === 'GET'),
        page.goto(path),
      ])
      expect(refused.status()).toBe(401)

      await expect(page).toHaveURL(/\/login$/)
      const alert = page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' })
      await expect(alert).toBeVisible()
      await expect(alert).toHaveText(SESSION_EXPIRED_MESSAGE)
    }
  })

  test('e-mail ou senha errados na tela de login não mostram o alerta de sessão expirada', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('admin@pontoderesgate.local')
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(SESSION_EXPIRED_MESSAGE)).toHaveCount(0)
  })

  test('falha ao carregar os pedidos que não é de autenticação mantém a sessão e a pessoa no painel', async ({
    page,
    request,
  }) => {
    const operator = await createOperator(request)
    await injectSession(page, operator.token, operator.user)
    await page.route(/\/api\/rescue-requests(\?.*)?$/, (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { message: 'Erro simulado.' } }) : route.continue(),
    )

    await page.goto('/painel')

    await expect(page.getByText('Não foi possível carregar os pedidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByText(SESSION_EXPIRED_MESSAGE)).toHaveCount(0)
    expect((await storedSession(page)).token).toBe(operator.token)
  })

  test('ação recusada por falta de permissão não encerra a sessão nem leva ao login', async ({ page, request }) => {
    const name = `E2E Sessão permissão ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })
    const operator = await createOperator(request)
    await injectSession(page, operator.token, operator.user)
    // A interface não oferece ao operador uma ação que o papel dele não permita,
    // então a resposta de permissão negada é simulada.
    await page.route(/\/api\/rescue-requests\/\d+\/assume$/, (route) =>
      route.fulfill({ status: 403, json: { message: 'Sem permissão.' } }),
    )

    await page.goto('/painel')
    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await card.getByRole('button', { name: 'Assumir' }).click()

    await expect(page).toHaveURL(/\/painel$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByText(SESSION_EXPIRED_MESSAGE)).toHaveCount(0)
    expect((await storedSession(page)).token).toBe(operator.token)
  })

  test('na tela pública, uma recusa de autenticação não leva ao login nem mostra o alerta de sessão', async ({
    page,
  }) => {
    // Sessão inválida guardada no navegador, e o envio recusado por autenticação: a
    // tela pública não exige login, então nada disso a tira da tela.
    await injectSession(page, 'token-invalido-e2e', { id: 0, name: 'E2E', role: 'operator' })
    await page.route(/\/api\/rescue-requests$/, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 401, json: { message: 'Não autenticado.' } })
        : route.continue(),
    )

    await page.goto('/')
    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
    await expect(page.getByText(/Localização selecionada/)).toBeVisible()
    await page.getByRole('button', { name: 'Enviar pedido' }).click()

    await expect(page.getByText('Não foi possível enviar o pedido. Tente novamente.')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(SESSION_EXPIRED_MESSAGE)).toHaveCount(0)
  })
})
