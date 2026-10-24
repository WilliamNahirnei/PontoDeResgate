import { test, expect, injectSession } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { createOperator, type Operator } from '../fixtures/operators'
import { showOneHundredPerPage } from '../fixtures/panel-pages'

const MY_REQUESTS = 'Meus pedidos'

function card(page, name: string) {
  return page.locator('.rescue-requests-list .v-card', { hasText: name })
}

function marker(page, id: number) {
  return page.getByTestId(`rescue-request-marker-${id}`)
}

function uniqueName(label: string) {
  return `E2E Meus ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function isListResponse(res) {
  return new URL(res.url()).pathname === '/api/rescue-requests' && res.request().method() === 'GET'
}

// Abre o painel com a sessão do operador e espera a primeira carga da lista.
async function openPanelAs(page, operator: Pick<Operator, 'token' | 'user'>) {
  await injectSession(page, operator.token, operator.user)
  const firstLoad = page.waitForResponse(isListResponse)
  await page.goto('/painel')
  await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
  await firstLoad
}

// Liga ou desliga o botão e espera a lista ser recarregada.
async function toggleMine(page) {
  await Promise.all([page.waitForResponse(isListResponse), page.getByRole('button', { name: MY_REQUESTS }).click()])
}

// Cria um pedido e o leva ao status pedido, com o operador dado como responsável.
async function createRequestOf(
  request,
  operator: Operator,
  label: string,
  finish: 'em_resgate' | 'concluido' | 'cancelado',
  overrides: Record<string, unknown> = {},
) {
  const rescueRequest = await createRescueRequest(request, { requester_name: uniqueName(label), ...overrides })
  if (finish === 'cancelado') {
    await changeRescueRequestStatus(request, rescueRequest.id, 'cancel', operator.token)
    return rescueRequest
  }
  await changeRescueRequestStatus(request, rescueRequest.id, 'assume', operator.token)
  if (finish === 'concluido') {
    await changeRescueRequestStatus(request, rescueRequest.id, 'complete', operator.token)
  }

  return rescueRequest
}

// Um operador novo (sem pedidos antes) com um pedido seu em cada status, um
// pedido pendente sem responsável e um pedido de outro operador. O operador é
// novo para que "Meus pedidos" tenha só o que o teste criou.
async function setUpMyRequests(request) {
  const me = await createOperator(request)
  const other = await createOperator(request)
  const inRescue = await createRequestOf(request, me, 'Em Resgate', 'em_resgate')
  const concluded = await createRequestOf(request, me, 'Concluido', 'concluido')
  const cancelled = await createRequestOf(request, me, 'Cancelado', 'cancelado')
  const pending = await createRescueRequest(request, { requester_name: uniqueName('Pendente') })
  const ofOther = await createRequestOf(request, other, 'De Outro', 'em_resgate')

  return { me, other, inRescue, concluded, cancelled, pending, ofOther }
}

test.describe('Painel — Meus pedidos', () => {
  test('ao abrir o painel, o botão "Meus pedidos" está desligado e a lista mostra também os pedidos de outros operadores', async ({
    page,
    request,
  }) => {
    const { me, ofOther, inRescue } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    await showOneHundredPerPage(page)

    await expect(page.getByRole('button', { name: MY_REQUESTS })).toHaveAttribute('aria-pressed', 'false')
    await expect(card(page, ofOther.requester_name)).toBeVisible()
    await expect(card(page, inRescue.requester_name)).toBeVisible()
  })

  test('com "Meus pedidos" ligado, a lista e o mapa mostram só os pedidos em que o operador logado é o responsável, em qualquer status', async ({
    page,
    request,
  }) => {
    const { me, inRescue, concluded, cancelled } = await setUpMyRequests(request)
    await openPanelAs(page, me)

    await toggleMine(page)

    for (const mine of [inRescue, concluded, cancelled]) {
      await expect(card(page, mine.requester_name)).toBeVisible()
      await expect(marker(page, mine.id)).toHaveCount(1)
    }
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(3)
  })

  test('com "Meus pedidos" ligado, um pedido Pendente, que ainda não tem responsável, não aparece na lista nem no mapa', async ({
    page,
    request,
  }) => {
    const { me, pending, inRescue } = await setUpMyRequests(request)
    await openPanelAs(page, me)

    await toggleMine(page)

    // O pedido do próprio operador aparece: sem isso, a ausência do pendente
    // passaria também com a lista ainda vazia.
    await expect(card(page, inRescue.requester_name)).toBeVisible()
    await expect(card(page, pending.requester_name)).toHaveCount(0)
    await expect(marker(page, pending.id)).toHaveCount(0)
  })

  test('com "Meus pedidos" ligado, um pedido cujo responsável é outro operador não aparece na lista nem no mapa', async ({
    page,
    request,
  }) => {
    const { me, ofOther, inRescue } = await setUpMyRequests(request)
    await openPanelAs(page, me)

    await toggleMine(page)

    await expect(card(page, inRescue.requester_name)).toBeVisible()
    await expect(card(page, ofOther.requester_name)).toHaveCount(0)
    await expect(marker(page, ofOther.id)).toHaveCount(0)
  })

  test('o botão "Meus pedidos" fica em destaque enquanto está ligado e sem destaque quando está desligado', async ({
    page,
    request,
  }) => {
    const { me } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    const button = page.getByRole('button', { name: MY_REQUESTS })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button).not.toHaveClass(/v-btn--variant-flat/)

    await toggleMine(page)

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveClass(/v-btn--variant-flat/)

    await toggleMine(page)

    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button).not.toHaveClass(/v-btn--variant-flat/)
  })

  test('desligar "Meus pedidos" volta a mostrar os pedidos de todos os operadores', async ({ page, request }) => {
    const { me, ofOther, pending } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    await showOneHundredPerPage(page)
    await toggleMine(page)
    await expect(card(page, ofOther.requester_name)).toHaveCount(0)

    await toggleMine(page)

    await expect(card(page, ofOther.requester_name)).toBeVisible()
    await expect(card(page, pending.requester_name)).toBeVisible()
  })

  test('"Meus pedidos" vale em conjunto com o filtro de status: ligado e com Em resgate escolhido, só aparecem os pedidos Em resgate do operador', async ({
    page,
    request,
  }) => {
    const { me, inRescue, concluded, cancelled } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    await toggleMine(page)
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(3)

    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Em resgate' }).click()

    await expect(card(page, inRescue.requester_name)).toBeVisible()
    await expect(card(page, concluded.requester_name)).toHaveCount(0)
    await expect(card(page, cancelled.requester_name)).toHaveCount(0)
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(1)
  })

  test('"Meus pedidos" vale em conjunto com a quantidade mínima: só aparecem os pedidos do operador que atendem ao mínimo', async ({
    page,
    request,
  }) => {
    const me = await createOperator(request)
    const big = await createRequestOf(request, me, 'Grande', 'em_resgate', { total_people: 40 })
    const small = await createRequestOf(request, me, 'Pequeno', 'em_resgate', { total_people: 2 })
    await openPanelAs(page, me)
    await toggleMine(page)
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(2)

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('10')

    await expect(card(page, big.requester_name)).toBeVisible()
    await expect(card(page, small.requester_name)).toHaveCount(0)
  })

  test('ligar ou desligar "Meus pedidos" com a lista na segunda página leva a lista de volta à primeira página', async ({
    page,
    request,
  }) => {
    const me = await createOperator(request)
    for (let index = 0; index < 6; index++) {
      await createRequestOf(request, me, `Pagina ${index}`, 'em_resgate')
    }
    await openPanelAs(page, me)
    const indicator = page.getByText(/^\d+-\d+ de \d+$/)
    await page.getByRole('combobox', { name: 'Pedidos por página' }).focus()
    await page.getByRole('combobox', { name: 'Pedidos por página' }).press('Enter')
    await page.getByRole('option', { name: '5', exact: true }).click()
    await expect(indicator).toHaveText(/^1-5 de /)

    // Ligar: da segunda página do painel inteiro para a primeira dos meus pedidos.
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(indicator).toHaveText(/^6-/)
    await toggleMine(page)
    await expect(indicator).toHaveText('1-5 de 6')

    // Desligar: da segunda página dos meus pedidos para a primeira do painel inteiro.
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(indicator).toHaveText('6-6 de 6')
    await toggleMine(page)
    await expect(indicator).toHaveText(/^1-5 de /)
  })

  test('"Limpar filtros" desliga "Meus pedidos" e a lista volta a mostrar os pedidos de todos', async ({ page, request }) => {
    const { me, ofOther } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    await showOneHundredPerPage(page)
    await toggleMine(page)
    await expect(card(page, ofOther.requester_name)).toHaveCount(0)

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click()

    await expect(page.getByRole('button', { name: MY_REQUESTS })).toHaveAttribute('aria-pressed', 'false')
    await expect(card(page, ofOther.requester_name)).toBeVisible()
  })

  test('o admin master também liga "Meus pedidos" e vê só os pedidos em que é o responsável', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const operator = await createOperator(request)
    const ofOperator = await createRequestOf(request, operator, 'Do Operador', 'em_resgate')
    const ofAdmin = await createRescueRequest(request, { requester_name: uniqueName('Do Admin') })
    // Sem token, a fixture age como admin master.
    await changeRescueRequestStatus(request, ofAdmin.id, 'assume')
    const firstLoad = page.waitForResponse(isListResponse)
    await page.goto('/painel')
    await firstLoad
    await showOneHundredPerPage(page)
    await expect(card(page, ofOperator.requester_name)).toBeVisible()

    await toggleMine(page)

    await expect(card(page, ofAdmin.requester_name)).toBeVisible()
    await expect(card(page, ofOperator.requester_name)).toHaveCount(0)
  })

  test('recarregar o painel com "Meus pedidos" ligado o abre desligado: o filtro não fica guardado no navegador', async ({
    page,
    request,
  }) => {
    const { me } = await setUpMyRequests(request)
    await openPanelAs(page, me)
    await toggleMine(page)
    await expect(page.getByRole('button', { name: MY_REQUESTS })).toHaveAttribute('aria-pressed', 'true')

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(page.getByRole('button', { name: MY_REQUESTS })).toHaveAttribute('aria-pressed', 'false')
  })

  test('com "Meus pedidos" ligado e nenhum pedido do operador, a lista não mostra páginas além da primeira e informa que não há pedidos', async ({
    page,
    request,
  }) => {
    const me = await createOperator(request)
    await openPanelAs(page, me)

    await toggleMine(page)

    await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible()
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeDisabled()
  })

  test('depois que outro operador conclui o pedido, "Meus pedidos" de quem concluiu passa a mostrá-lo e o de quem o assumiu deixa de mostrá-lo', async ({
    page,
    request,
    browser,
  }) => {
    const assigned = await createOperator(request)
    const completing = await createOperator(request)
    const rescueRequest = await createRequestOf(request, assigned, 'Troca', 'em_resgate')
    await openPanelAs(page, assigned)
    await toggleMine(page)
    await expect(card(page, rescueRequest.requester_name)).toBeVisible()

    await changeRescueRequestStatus(request, rescueRequest.id, 'complete', completing.token)

    await page.getByRole('button', { name: 'Atualizar' }).click()
    await expect(card(page, rescueRequest.requester_name)).toHaveCount(0)

    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5183' })
    const completingPage = await context.newPage()
    await openPanelAs(completingPage, completing)
    await toggleMine(completingPage)

    await expect(card(completingPage, rescueRequest.requester_name)).toBeVisible()
    await expect(card(completingPage, rescueRequest.requester_name).getByText('Concluído', { exact: true })).toBeVisible()
    await context.close()
  })
})
