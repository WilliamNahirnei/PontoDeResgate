import { test, expect } from '../fixtures/auth'
import { changeRescueRequestStatus } from '../fixtures/rescue-requests'
import { randomCoordinates } from '../fixtures/map'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const PER_PAGE_STORAGE_KEY = 'pontoderesgate.panelPerPage'
const PER_PAGE_LABEL = 'Pedidos por página'
const INDICATOR = /^\d+-\d+ de \d+$/

async function selectOption(page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).focus()
  await page.getByRole('combobox', { name: combobox }).press('Enter')
  await page.getByRole('option', { name: option, exact: true }).click()
}

// O banco é compartilhado e acumula pedidos entre execuções: nenhum teste
// supõe um total absoluto. Cada um cria os pedidos de que precisa (todos
// pendentes e mais recentes que os demais) e confere só posições relativas.
async function seedRescueRequests(request, count: number, overrides: Record<string, unknown> = {}) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      request.post(`${API_BASE_URL}/api/rescue-requests`, {
        data: {
          latitude: -23.5505,
          longitude: -46.6333,
          requester_name: `E2E Paginação ${unique} #${index}`,
          total_people: 3,
          ...randomCoordinates(),
          ...overrides,
        },
      }),
    ),
  )
}

async function apiTotal(request, token: string, query: string): Promise<number> {
  const response = await request.get(`${API_BASE_URL}/api/rescue-requests?per_page=5&${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return (await response.json()).meta.total
}

async function ensureAtLeast(request, token: string, minimum: number) {
  const total = await apiTotal(request, token, '')
  if (total < minimum) {
    await seedRescueRequests(request, minimum - total)
  }
}

const cards = (page) => page.locator('.rescue-requests-list .v-card')
const markers = (page) => page.locator('[data-testid^="rescue-request-marker-"]')
const indicator = (page) => page.getByText(INDICATOR)

async function cardTexts(page): Promise<string[]> {
  return cards(page).allInnerTexts()
}

async function markerIds(page): Promise<string[]> {
  return markers(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
}

// Posição e zoom do mapa: o painel de arrasto do Leaflet só muda de
// transformação quando o mapa é reposicionado, e a URL dos tiles traz o zoom.
async function mapView(page) {
  return page.evaluate(() => ({
    pane: document.querySelector('.leaflet-map-pane')?.getAttribute('style') ?? '',
    tile: document.querySelector('.leaflet-tile')?.getAttribute('src')?.split('/').slice(-3, -2)[0] ?? '',
  }))
}

async function openPanel(page, perPage?: number) {
  await page.goto('/painel')
  await expect(indicator(page)).toBeVisible()
  if (perPage !== undefined && perPage !== 50) {
    await selectOption(page, PER_PAGE_LABEL, String(perPage))
    await expect(indicator(page)).toHaveText(new RegExp(`^1-${perPage} de \\d+$`))
  }
}

// Pedidos novos (de testes rodando em paralelo) entram no fim da lista em ordem
// crescente por data/hora: as primeiras páginas ficam estáveis para comparar.
async function useStableOrder(page) {
  await page.locator('button:has(i.mdi-sort-ascending)').click()
  await expect(indicator(page)).toHaveText(/^1-\d+ de \d+$/)
}

async function goToNextPage(page) {
  await page.getByRole('button', { name: 'Próxima página' }).click()
}

test.describe('Painel — paginação', () => {
  test('ao abrir o painel com mais de 50 pedidos, a lista mostra 50 cards e o indicador "1-50 de N"', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const token = await loginAsAdminMaster()
    await ensureAtLeast(request, token, 51)

    await page.goto('/painel')

    await expect(indicator(page)).toHaveText(/^1-50 de \d+$/)
    await expect(cards(page)).toHaveCount(50)
  })

  test('o seletor de quantidade por página oferece exatamente 5, 10, 20, 30, 50 e 100, com 50 selecionado ao abrir', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')
    await expect(indicator(page)).toBeVisible()

    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).focus()
    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).press('Enter')

    const options = page.getByRole('option')
    await expect(options).toHaveText(['5', '10', '20', '30', '50', '100'])
    await expect(page.getByRole('option', { name: '50', exact: true })).toHaveAttribute('aria-selected', 'true')
  })

  test('escolher 10 por página mostra 10 cards e o indicador "1-10 de N"', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)

    await openPanel(page)
    await selectOption(page, PER_PAGE_LABEL, '10')

    await expect(indicator(page)).toHaveText(/^1-10 de \d+$/)
    await expect(cards(page)).toHaveCount(10)
  })

  test('ir para a página seguinte mostra os pedidos seguintes, diferentes dos da primeira página, e o indicador acompanha', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)
    await useStableOrder(page)
    const firstPage = await cardTexts(page)

    await goToNextPage(page)

    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await expect(cards(page)).toHaveCount(5)
    const secondPage = await cardTexts(page)
    expect(secondPage.filter((text) => firstPage.includes(text))).toEqual([])
  })

  test('na primeira página os botões de página anterior e primeira ficam indisponíveis; na última, os de página seguinte e última', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)

    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeEnabled()

    await page.getByRole('button', { name: 'Última página' }).click()

    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
  })

  test('o mapa mostra só os marcadores dos pedidos da página aberta, a mesma quantidade de cards da lista', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)

    await openPanel(page, 5)

    await expect(cards(page)).toHaveCount(5)
    await expect(markers(page)).toHaveCount(5)
  })

  test('ao trocar de página, o mapa passa a mostrar os marcadores da nova página, sem se reposicionar', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)
    await useStableOrder(page)
    await expect(markers(page)).toHaveCount(5)
    const firstPageMarkers = await markerIds(page)
    const viewBefore = await mapView(page)

    await goToNextPage(page)

    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await expect(markers(page)).toHaveCount(5)
    const secondPageMarkers = await markerIds(page)
    expect(secondPageMarkers.filter((id) => firstPageMarkers.includes(id))).toEqual([])
    expect(await mapView(page)).toEqual(viewBefore)
  })

  test('mudar o status ou uma quantidade mínima com a lista na segunda página leva a lista de volta à primeira página', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await selectOption(page, 'Status', 'Pendente')
    await expect(indicator(page)).toHaveText(/^1-5 de \d+$/)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('1')
    await expect(indicator(page)).toHaveText(/^1-5 de \d+$/)
  })

  test('mudar a ordenação com a lista na segunda página leva a lista de volta à primeira página', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await selectOption(page, 'Ordenar por', 'Total de pessoas')

    await expect(indicator(page)).toHaveText(/^1-5 de \d+$/)
  })

  test('mudar a quantidade por página com a lista na segunda página leva a lista de volta à primeira página', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    await selectOption(page, PER_PAGE_LABEL, '10')

    await expect(indicator(page)).toHaveText(/^1-10 de \d+$/)
  })

  test('"Limpar filtros" leva a lista à primeira página e mantém a quantidade por página escolhida', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 10)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^11-\d+ de \d+$/)
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click()

    await expect(indicator(page)).toHaveText(/^1-10 de \d+$/)
    await expect(cards(page)).toHaveCount(10)
  })

  test('a quantidade por página escolhida continua a mesma depois de recarregar o painel', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 21)
    await openPanel(page, 20)

    const reloaded = page.waitForRequest((req) => req.url().includes('/api/rescue-requests?') && req.url().includes('per_page=20'))
    await page.reload()
    await reloaded

    await expect(indicator(page)).toHaveText(/^1-20 de \d+$/)
    await expect(cards(page)).toHaveCount(20)
    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).focus()
    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).press('Enter')
    await expect(page.getByRole('option', { name: '20', exact: true })).toHaveAttribute('aria-selected', 'true')
  })

  test('com um valor inválido guardado no navegador como quantidade por página, o painel abre com 50 por página', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.addInitScript(([key]) => window.localStorage.setItem(key, '7'), [PER_PAGE_STORAGE_KEY])

    const opened = page.waitForRequest((req) => req.url().includes('/api/rescue-requests?'))
    await page.goto('/painel')
    const firstRequest = await opened

    expect(firstRequest.url()).toContain('per_page=50')
    await expect(indicator(page)).toBeVisible()
    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).focus()
    await page.getByRole('combobox', { name: PER_PAGE_LABEL }).press('Enter')
    await expect(page.getByRole('option', { name: '50', exact: true })).toHaveAttribute('aria-selected', 'true')
  })

  test('assumir um pedido com a lista na segunda página atualiza a página aberta, sem voltar à primeira', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 11)
    await openPanel(page, 5)

    await goToNextPage(page)
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
    const target = cards(page).first()

    // Outros testes criam pedidos em paralelo e podem empurrar este card para
    // outra página: a prova é a lista ter sido buscada de novo na página 2.
    const assumeResponse = page.waitForResponse(
      (response) => response.url().includes('/assume') && response.request().method() === 'POST',
    )
    const reloadedSecondPage = page.waitForRequest(
      (req) => req.method() === 'GET' && req.url().includes('/api/rescue-requests?') && req.url().includes('page=2'),
    )
    await target.getByRole('button', { name: 'Assumir' }).click()

    expect((await assumeResponse).ok()).toBe(true)
    await reloadedSecondPage
    await expect(indicator(page)).toHaveText(/^6-10 de \d+$/)
  })

  test('com filtro aplicado, o indicador e as páginas contam só os pedidos que atendem ao filtro', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const token = await loginAsAdminMaster()
    await seedRescueRequests(request, 6)
    const list = await request.get(`${API_BASE_URL}/api/rescue-requests?per_page=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const toCancel = (await list.json()).data[0]
    await changeRescueRequestStatus(request, toCancel.id, 'cancel')

    await openPanel(page, 5)
    await selectOption(page, 'Status', 'Cancelado')

    const expectedTotal = await apiTotal(request, token, 'status=cancelado')
    const shown = Math.min(5, expectedTotal)
    await expect(indicator(page)).toHaveText(`1-${shown} de ${expectedTotal}`)
    await expect(cards(page)).toHaveCount(shown)
  })

  test('sem nenhum pedido que atenda aos filtros, a lista não mostra página seguinte e informa que não há pedidos', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // O banco compartilhado não garante um filtro sem resultado: a resposta
    // vazia do filtro de animais é simulada, só para conferir o que a tela
    // mostra quando nada atende aos filtros.
    await page.route('**/api/rescue-requests?**min_animals_count=**', (route) =>
      route.fulfill({
        json: {
          data: [],
          meta: { current_page: 1, from: null, last_page: 1, per_page: 50, to: null, total: 0 },
        },
      }),
    )
    await openPanel(page)

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. animais').fill('5')

    await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeDisabled()
  })

  test('ordenando por uma quantidade, os pedidos sem a quantidade informada ficam no fim da última página, e não no fim de cada página', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    // Percorre todas as páginas do banco compartilhado.
    test.setTimeout(120_000)
    await loginAsAdminMaster()
    await seedRescueRequests(request, 6, { total_people: null })
    await seedRescueRequests(request, 6, { total_people: 4 })
    await openPanel(page, 100)
    await selectOption(page, 'Ordenar por', 'Total de pessoas')
    await expect(indicator(page)).toHaveText(/^1-\d+ de \d+$/)

    // Percorre todas as páginas: depois do primeiro pedido sem quantidade, só
    // pode haver pedidos sem quantidade, mesmo em páginas seguintes.
    const informed: boolean[] = []
    for (;;) {
      const texts = await cardTexts(page)
      informed.push(...texts.map((text) => !text.includes('Quantidade de pessoas não informada')))
      if (await page.getByRole('button', { name: 'Próxima página' }).isDisabled()) {
        break
      }
      const current = await indicator(page).innerText()
      await goToNextPage(page)
      await expect(indicator(page)).not.toHaveText(current)
    }

    const firstUninformed = informed.indexOf(false)
    expect(firstUninformed).toBeGreaterThan(-1)
    expect(informed.slice(firstUninformed).every((isInformed) => !isInformed)).toBe(true)
  })

  test('os textos da paginação (indicador, seletor de quantidade e botões de página) aparecem em português', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await seedRescueRequests(request, 6)

    await openPanel(page)

    await expect(indicator(page)).toBeVisible()
    await expect(page.getByRole('combobox', { name: PER_PAGE_LABEL })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeVisible()
  })
})
