import { test, expect } from '../fixtures/auth'
import { createRescueRequest } from '../fixtures/rescue-requests'
import { randomCoordinates, stableBoundingBox } from '../fixtures/map'

const TOOLTIP = '.leaflet-tooltip'

// Tamanho do círculo do marcador: 26px quando o pedido está selecionado, 18px
// quando não (RescueRequestsMap.vue).
async function markerSize(page, id: number) {
  const box = await page.getByTestId(`rescue-request-marker-${id}`).locator('span').boundingBox()
  return Math.round(box.width)
}

function formatDateTime(page, value: string) {
  return page.evaluate((isoDate) => new Date(isoDate).toLocaleString('pt-BR'), value)
}

test.describe('Painel — visualização de pedidos', () => {
  test('mapa e lista exibem os mesmos pedidos simultaneamente (sem alternância por abas)', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E SplitView ${Date.now()}` })

    await page.goto('/painel')

    await expect(page.locator('.panel-map')).toBeVisible()
    await expect(page.locator('.panel-list')).toBeVisible()
    await expect(page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)).toBeVisible()
    await expect(
      page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name }),
    ).toBeVisible()
  })

  test('hover em um marcador do mapa mostra a quantidade de pessoas e a data/hora do pedido', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // Coordenada exclusiva deste teste, com um pequeno deslocamento derivado
    // do timestamp: os pedidos criados por outros testes (e por execuções
    // anteriores desta própria suíte, já que o reset de banco não roda a
    // cada teste) se acumulam no mesmo banco. Dois marcadores no mesmo ponto
    // exato se sobrepõem no mapa e o hover acaba caindo no marcador errado.
    const jitter = (Date.now() % 10000) / 100000
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Hover ${Date.now()}`,
      total_people: 7,
      latitude: -15.7801 + jitter,
      longitude: -47.9292 + jitter,
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    // Mesmo com o deslocamento, com muitos pedidos no mapa outro marcador pode
    // ficar por cima e receber o mouse: dispara o hover no próprio marcador.
    await marker.dispatchEvent('mouseover')

    await expect(page.locator('.leaflet-tooltip')).toContainText('7 pessoa(s)')
  })

  test('atualizar a lista pelo botão "Atualizar" não reposiciona o mapa', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const requestA = await createRescueRequest(request, {
      requester_name: `E2E Mapa A ${unique}`,
      latitude: -23.5505,
      longitude: -46.6333,
    })
    await createRescueRequest(request, {
      requester_name: `E2E Mapa B ${unique}`,
      latitude: -22.9068,
      longitude: -43.1729,
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${requestA.id}`)
    await expect(marker).toBeVisible()

    const positionBefore = await stableBoundingBox(marker)

    const refreshed = page.waitForResponse(
      (response) => response.url().includes('/api/rescue-requests') && response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: 'Atualizar' }).click()
    await refreshed
    await expect(marker).toBeVisible()

    const positionAfter = await stableBoundingBox(marker)

    expect(positionAfter.x).toBeCloseTo(positionBefore.x, 0)
    expect(positionAfter.y).toBeCloseTo(positionBefore.y, 0)
  })

  test('clicar em um pedido na lista o destaca; clicar em outro substitui o destaque anterior', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const first = await createRescueRequest(request, { requester_name: `E2E Destaque A ${unique}` })
    const second = await createRescueRequest(request, { requester_name: `E2E Destaque B ${unique}` })

    await page.goto('/painel')

    const cardA = page.locator('.rescue-requests-list .v-card', { hasText: first.requester_name })
    const cardB = page.locator('.rescue-requests-list .v-card', { hasText: second.requester_name })

    await cardA.click()
    await expect(cardA).toHaveClass(/v-card--variant-tonal/)

    await cardB.click()
    await expect(cardB).toHaveClass(/v-card--variant-tonal/)
    await expect(cardA).not.toHaveClass(/v-card--variant-tonal/)
  })

  test('clicar em um pedido na lista destaca o marcador no mapa com as informações do hover; clicar em outro fecha as do anterior', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const first = await createRescueRequest(request, {
      requester_name: `E2E Selecao Lista A ${unique}`,
      total_people: 37,
      ...randomCoordinates(),
    })
    const second = await createRescueRequest(request, {
      requester_name: `E2E Selecao Lista B ${unique}`,
      total_people: 41,
      ...randomCoordinates(),
    })

    await page.goto('/painel')
    await expect(page.getByTestId(`rescue-request-marker-${first.id}`)).toBeVisible()
    expect(await markerSize(page, first.id)).toBe(18)

    await page.locator('.rescue-requests-list .v-card', { hasText: first.requester_name }).click()

    await expect.poll(() => markerSize(page, first.id)).toBe(26)
    const firstTooltip = page.locator(TOOLTIP, { hasText: '37 pessoa(s)' })
    await expect(firstTooltip).toBeVisible()
    await expect(firstTooltip).toContainText(await formatDateTime(page, first.created_at))

    await page.locator('.rescue-requests-list .v-card', { hasText: second.requester_name }).click()

    await expect.poll(() => markerSize(page, second.id)).toBe(26)
    await expect.poll(() => markerSize(page, first.id)).toBe(18)
    await expect(page.locator(TOOLTIP, { hasText: '41 pessoa(s)' })).toBeVisible()
    await expect(firstTooltip).toHaveCount(0)
  })

  test('hover em um marcador mostra também a data/hora do pedido', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Hover Data ${Date.now()}`,
      total_people: 53,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    // Dispara o hover no próprio marcador: com o banco acumulando pedidos,
    // outro marcador pode ficar por cima e receber o mouse no lugar dele.
    await marker.dispatchEvent('mouseover')

    const tooltip = page.locator(TOOLTIP, { hasText: '53 pessoa(s)' })
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(await formatDateTime(page, rescueRequest.created_at))
  })

  test('na primeira carga, o mapa se ajusta para enquadrar todos os pedidos, sem partir de uma região fixa', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    // Duas cidades distantes entre si e do centro padrão do mapa (São Paulo).
    const north = await createRescueRequest(request, {
      requester_name: `E2E Enquadramento Manaus ${unique}`,
      latitude: -3.119,
      longitude: -60.0217,
    })
    const south = await createRescueRequest(request, {
      requester_name: `E2E Enquadramento Porto Alegre ${unique}`,
      latitude: -30.0346,
      longitude: -51.2177,
    })

    await page.goto('/painel')

    const mapBox = await page.locator('.panel-map').boundingBox()
    for (const rescueRequest of [north, south]) {
      const box = await stableBoundingBox(page.getByTestId(`rescue-request-marker-${rescueRequest.id}`))
      expect(box.x).toBeGreaterThanOrEqual(mapBox.x)
      expect(box.y).toBeGreaterThanOrEqual(mapBox.y)
      expect(box.x + box.width).toBeLessThanOrEqual(mapBox.x + mapBox.width)
      expect(box.y + box.height).toBeLessThanOrEqual(mapBox.y + mapBox.height)
    }
  })

  test('depois da primeira carga, mudar o status de um pedido ou o filtro não reposiciona o mapa', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Reposicionamento ${Date.now()}`,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    const initialPosition = await stableBoundingBox(marker)

    const card = page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
    await card.getByRole('button', { name: 'Assumir' }).click()
    await expect(card.getByText('Em resgate')).toBeVisible()

    const afterStatusChange = await stableBoundingBox(marker)
    expect(afterStatusChange.x).toBeCloseTo(initialPosition.x, 0)
    expect(afterStatusChange.y).toBeCloseTo(initialPosition.y, 0)

    const filtered = page.waitForResponse(
      (response) => response.url().includes('status=em_resgate') && response.request().method() === 'GET',
    )
    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Em resgate' }).click()
    await filtered

    const afterFilterChange = await stableBoundingBox(marker)
    expect(afterFilterChange.x).toBeCloseTo(initialPosition.x, 0)
    expect(afterFilterChange.y).toBeCloseTo(initialPosition.y, 0)
  })

  test('hover em um marcador de pedido sem quantidade total informada indica que ela não foi informada', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Hover Sem Total ${Date.now()}`,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    await marker.dispatchEvent('mouseover')

    const tooltip = page.locator(TOOLTIP, { hasText: await formatDateTime(page, rescueRequest.created_at) })
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(/não informad/i)
  })

  test('card de pedido sem quantidade total informada indica que ela não foi informada, com o mesmo texto do hover', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Card Sem Total ${Date.now()}`,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    await marker.dispatchEvent('mouseover')
    const tooltip = page.locator(TOOLTIP, { hasText: await formatDateTime(page, rescueRequest.created_at) })
    await expect(tooltip).toContainText(/não informad/i)
    // O tooltip é "<quantidade> · <data/hora>": a parte da quantidade é o que o
    // card precisa repetir.
    const hoverPeopleText = (await tooltip.textContent()).split(' · ')[0].trim()

    const card = page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
    await expect(card).toContainText(hoverPeopleText)
    await expect(card).not.toContainText('?')
  })

  test('card mostra só as categorias de pessoas informadas; as não informadas não aparecem', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Card Categorias Parciais ${Date.now()}`,
      total_people: 3,
      men_count: 1,
      children_count: 2,
    })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
    await expect(card).toContainText(/homens?\D{0,3}1\b|\b1\D{0,3}homens?/i)
    await expect(card).toContainText(/crianças?\D{0,3}2\b|\b2\D{0,3}crianças?/i)
    await expect(card).not.toContainText(/mulher/i)
    await expect(card).not.toContainText(/idos/i)
    await expect(card).not.toContainText('?')
  })

  test('categoria informada como zero aparece no card com o valor zero, diferente de uma não informada', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Card Categoria Zero ${Date.now()}`,
      total_people: 2,
      men_count: 0,
      women_count: 2,
    })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
    await expect(card).toContainText(/homens?\D{0,3}0\b|\b0\D{0,3}homens?/i)
    await expect(card).toContainText(/mulheres?\D{0,3}2\b|\b2\D{0,3}mulheres?/i)
    await expect(card).not.toContainText(/idos/i)
  })

  test('quando não há nenhum pedido na primeira carga, o painel informa que não há pedidos a exibir', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // O banco compartilhado nunca está vazio: simula a resposta sem pedidos.
    await page.route('**/api/rescue-requests**', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: { data: [] } }) : route.continue(),
    )

    // A mensagem também aparece enquanto a lista carrega: espera a resposta.
    const loaded = page.waitForResponse(
      (response) => response.url().includes('/api/rescue-requests') && response.request().method() === 'GET',
    )
    await page.goto('/painel')
    await loaded

    await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible()
    await expect(page.locator('.rescue-requests-list .v-card')).toHaveCount(0)
  })

  test('clicar em um marcador seleciona o pedido no mapa e na lista; clicar em outro marcador troca a seleção', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const first = await createRescueRequest(request, {
      requester_name: `E2E Selecao Mapa A ${unique}`,
      total_people: 59,
      ...randomCoordinates(),
    })
    const second = await createRescueRequest(request, {
      requester_name: `E2E Selecao Mapa B ${unique}`,
      total_people: 61,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const cardA = page.locator('.rescue-requests-list .v-card', { hasText: first.requester_name })
    const cardB = page.locator('.rescue-requests-list .v-card', { hasText: second.requester_name })
    await expect(cardA).toBeVisible()
    await expect(cardA).not.toHaveClass(/v-card--variant-tonal/)

    // Clique disparado no próprio marcador: outro marcador pode estar por cima.
    await page.getByTestId(`rescue-request-marker-${first.id}`).dispatchEvent('click')

    await expect.poll(() => markerSize(page, first.id)).toBe(26)
    await expect(page.locator(TOOLTIP, { hasText: '59 pessoa(s)' })).toBeVisible()
    await expect(cardA).toHaveClass(/v-card--variant-tonal/)

    await page.getByTestId(`rescue-request-marker-${second.id}`).dispatchEvent('click')

    await expect.poll(() => markerSize(page, second.id)).toBe(26)
    await expect.poll(() => markerSize(page, first.id)).toBe(18)
    await expect(page.locator(TOOLTIP, { hasText: '61 pessoa(s)' })).toBeVisible()
    await expect(page.locator(TOOLTIP, { hasText: '59 pessoa(s)' })).toHaveCount(0)
    await expect(cardB).toHaveClass(/v-card--variant-tonal/)
    await expect(cardA).not.toHaveClass(/v-card--variant-tonal/)
  })

  test('os botões de aproximar e afastar do mapa do painel têm nomes em português', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')

    const map = page.locator('.panel-map')
    await expect(map.getByRole('button', { name: 'Aproximar' })).toBeVisible()
    await expect(map.getByRole('button', { name: 'Afastar' })).toBeVisible()
  })
})
