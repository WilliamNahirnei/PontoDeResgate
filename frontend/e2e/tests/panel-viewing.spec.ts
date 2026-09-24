import { test, expect } from '../fixtures/auth'
import { createRescueRequest } from '../fixtures/rescue-requests'

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
    await marker.hover()

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

    // O enquadramento da primeira carga é animado: medir durante a animação
    // dá uma posição que ainda vai mudar. Espera duas leituras seguidas iguais.
    async function stablePosition() {
      let previous = null
      let current = null
      await expect
        .poll(async () => {
          previous = current
          current = await marker.boundingBox()
          return (
            previous !== null &&
            current !== null &&
            Math.abs(current.x - previous.x) < 0.5 &&
            Math.abs(current.y - previous.y) < 0.5
          )
        })
        .toBe(true)
      return current
    }

    const positionBefore = await stablePosition()

    const refreshed = page.waitForResponse(
      (response) => response.url().includes('/api/rescue-requests') && response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: 'Atualizar' }).click()
    await refreshed
    await expect(marker).toBeVisible()

    const positionAfter = await stablePosition()

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
})
