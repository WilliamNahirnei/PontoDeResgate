import { test, expect } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { randomCoordinates, stableBoundingBox } from '../fixtures/map'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

async function selectOption(page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).focus()
  await page.getByRole('combobox', { name: combobox }).press('Enter')
  await page.getByRole('option', { name: option, exact: true }).click()
}

function card(page, name: string) {
  return page.locator('.rescue-requests-list .v-card', { hasText: name })
}

// Posição de cada nome no texto da lista (-1 quando não aparece).
async function listPositions(page, names: string[]) {
  const text = await page.locator('.rescue-requests-list').innerText()
  return names.map((name) => text.indexOf(name))
}

// A data/hora do pedido tem resolução de segundos: para dois pedidos terem
// horários diferentes, o segundo precisa ser criado no segundo seguinte.
async function waitForNextSecond() {
  const current = Math.floor(Date.now() / 1000)
  await expect.poll(() => Math.floor(Date.now() / 1000), { intervals: [100] }).toBeGreaterThan(current)
}

test.describe('Painel — filtros e ordenação', () => {
  test('filtro por status reflete na lista', async ({ page, request, loginAsAdminMaster }) => {
    const adminToken = await loginAsAdminMaster()
    const unique = Date.now()

    const pendingName = `E2E Filtro Status Pendente ${unique}`
    const cancelledName = `E2E Filtro Status Cancelado ${unique}`

    await createRescueRequest(request, { requester_name: pendingName })
    const toCancel = await createRescueRequest(request, { requester_name: cancelledName })

    await request.post(`${API_BASE_URL}/api/rescue-requests/${toCancel.id}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { cancellation_reason: 'Cancelado para teste E2E de filtro.' },
    })

    await page.goto('/painel')

    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Cancelado' }).click()

    await expect(page.getByText(cancelledName)).toBeVisible()
    await expect(page.getByText(pendingName)).toHaveCount(0)

    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Pendente', exact: true }).click()

    await expect(page.getByText(pendingName)).toBeVisible()
    await expect(page.getByText(cancelledName)).toHaveCount(0)
  })

  test('filtro por quantidade mínima reflete na lista', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const unique = Date.now()

    const smallName = `E2E Filtro Quantidade Baixa ${unique}`
    const bigName = `E2E Filtro Quantidade Alta ${unique}`

    await createRescueRequest(request, { requester_name: smallName, total_people: 2 })
    await createRescueRequest(request, { requester_name: bigName, total_people: 20 })

    await page.goto('/painel')

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('10')

    await expect(page.getByText(bigName)).toBeVisible()
    await expect(page.getByText(smallName)).toHaveCount(0)
  })

  test('ordenação por quantidade reflete na ordem da lista', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const unique = Date.now()

    const low = { name: `E2E Ordenacao Baixa ${unique}`, total_people: 1 }
    const mid = { name: `E2E Ordenacao Media ${unique}`, total_people: 5 }
    const high = { name: `E2E Ordenacao Alta ${unique}`, total_people: 9 }

    await createRescueRequest(request, { requester_name: low.name, total_people: low.total_people })
    await createRescueRequest(request, { requester_name: mid.name, total_people: mid.total_people })
    await createRescueRequest(request, { requester_name: high.name, total_people: high.total_people })

    await page.goto('/painel')

    await page.getByRole('combobox', { name: 'Ordenar por' }).focus()
    await page.getByRole('combobox', { name: 'Ordenar por' }).press('Enter')
    await page.getByRole('option', { name: 'Total de pessoas' }).click()
    await page.locator('button:has(i.mdi-sort-ascending)').click()

    await expect(async () => {
      const text = await page.locator('.rescue-requests-list').innerText()
      expect(text.indexOf(low.name)).toBeGreaterThanOrEqual(0)
      expect(text.indexOf(low.name)).toBeLessThan(text.indexOf(mid.name))
      expect(text.indexOf(mid.name)).toBeLessThan(text.indexOf(high.name))
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()

    await expect(async () => {
      const text = await page.locator('.rescue-requests-list').innerText()
      expect(text.indexOf(high.name)).toBeGreaterThanOrEqual(0)
      expect(text.indexOf(high.name)).toBeLessThan(text.indexOf(mid.name))
      expect(text.indexOf(mid.name)).toBeLessThan(text.indexOf(low.name))
    }).toPass()
  })

  test('ordenar pela data/hora do pedido, nas duas direções, reordena a lista', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const older = await createRescueRequest(request, { requester_name: `E2E Ordem Data Antigo ${unique}` })
    await waitForNextSecond()
    const newer = await createRescueRequest(request, { requester_name: `E2E Ordem Data Recente ${unique}` })

    await page.goto('/painel')
    await expect(card(page, newer.requester_name)).toBeVisible()

    await page.locator('button:has(i.mdi-sort-ascending)').click()
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name])
      expect(olderIndex).toBeGreaterThanOrEqual(0)
      expect(olderIndex).toBeLessThan(newerIndex)
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name])
      expect(newerIndex).toBeGreaterThanOrEqual(0)
      expect(newerIndex).toBeLessThan(olderIndex)
    }).toPass()
  })

  test('filtro por status também altera os marcadores exibidos no mapa', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const pending = await createRescueRequest(request, { requester_name: `E2E Mapa Status Pendente ${unique}` })
    const cancelled = await createRescueRequest(request, { requester_name: `E2E Mapa Status Cancelado ${unique}` })
    await changeRescueRequestStatus(request, cancelled.id, 'cancel')

    await page.goto('/painel')

    const pendingMarker = page.getByTestId(`rescue-request-marker-${pending.id}`)
    const cancelledMarker = page.getByTestId(`rescue-request-marker-${cancelled.id}`)
    await expect(pendingMarker).toBeVisible()
    await expect(cancelledMarker).toBeVisible()

    await selectOption(page, 'Status', 'Cancelado')
    await expect(pendingMarker).toHaveCount(0)
    await expect(cancelledMarker).toBeVisible()

    await selectOption(page, 'Status', 'Pendente')
    await expect(cancelledMarker).toHaveCount(0)
    await expect(pendingMarker).toBeVisible()
  })

  test('"Limpar filtros" remove as quantidades mínimas e a lista volta a mostrar os pedidos escondidos', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const smallName = `E2E Limpar Baixa ${unique}`
    const bigName = `E2E Limpar Alta ${unique}`
    await createRescueRequest(request, { requester_name: smallName, total_people: 2 })
    await createRescueRequest(request, { requester_name: bigName, total_people: 20 })

    await page.goto('/painel')

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('10')
    await expect(card(page, bigName)).toBeVisible()
    await expect(card(page, smallName)).toHaveCount(0)

    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click()

    await expect(page.getByLabel('Mín. total de pessoas')).toHaveValue('')
    await expect(card(page, smallName)).toBeVisible()
    await expect(card(page, bigName)).toBeVisible()
  })

  test('filtro por quantidade mínima funciona para cada categoria, não só para o total', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const categories = [
      { label: 'Mín. homens', field: 'men_count' },
      { label: 'Mín. mulheres', field: 'women_count' },
      { label: 'Mín. crianças', field: 'children_count' },
      { label: 'Mín. idosos', field: 'elderly_count' },
      { label: 'Mín. animais', field: 'animals_count' },
    ]
    for (const category of categories) {
      await createRescueRequest(request, { requester_name: `E2E Categoria ${category.field} Alta ${unique}`, [category.field]: 20 })
      await createRescueRequest(request, { requester_name: `E2E Categoria ${category.field} Baixa ${unique}`, [category.field]: 2 })
    }

    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()

    for (const category of categories) {
      const bigCard = card(page, `E2E Categoria ${category.field} Alta ${unique}`)
      const smallCard = card(page, `E2E Categoria ${category.field} Baixa ${unique}`)

      await expect(smallCard).toBeVisible()
      await page.getByLabel(category.label).fill('10')
      await expect(smallCard, category.label).toHaveCount(0)
      await expect(bigCard, category.label).toBeVisible()

      await page.getByLabel(category.label).fill('')
      await expect(smallCard).toBeVisible()
    }
  })

  test('com filtro de quantidade mínima, o pedido sem essa quantidade informada some da lista e do mapa', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const withoutTotal = await createRescueRequest(request, { requester_name: `E2E Sem Total ${unique}` })
    const withTotal = await createRescueRequest(request, { requester_name: `E2E Com Total ${unique}`, total_people: 20 })

    await page.goto('/painel')

    const withoutTotalMarker = page.getByTestId(`rescue-request-marker-${withoutTotal.id}`)
    await expect(card(page, withoutTotal.requester_name)).toBeVisible()
    await expect(withoutTotalMarker).toBeVisible()

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('10')

    await expect(card(page, withTotal.requester_name)).toBeVisible()
    await expect(card(page, withoutTotal.requester_name)).toHaveCount(0)
    await expect(withoutTotalMarker).toHaveCount(0)
  })

  test('ao ordenar por uma quantidade, os pedidos sem ela informada ficam no fim da lista, nas duas direções', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const three = `E2E Nulos Tres ${unique}`
    const seven = `E2E Nulos Sete ${unique}`
    const missing = `E2E Nulos Sem Total ${unique}`
    await createRescueRequest(request, { requester_name: three, total_people: 3 })
    await createRescueRequest(request, { requester_name: missing })
    await createRescueRequest(request, { requester_name: seven, total_people: 7 })

    await page.goto('/painel')
    await selectOption(page, 'Ordenar por', 'Total de pessoas')

    await page.locator('button:has(i.mdi-sort-ascending)').click()
    await expect(async () => {
      const [threeIndex, sevenIndex, missingIndex] = await listPositions(page, [three, seven, missing])
      expect(threeIndex).toBeGreaterThanOrEqual(0)
      expect(threeIndex).toBeLessThan(sevenIndex)
      expect(sevenIndex).toBeLessThan(missingIndex)
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()
    await expect(async () => {
      const [threeIndex, sevenIndex, missingIndex] = await listPositions(page, [three, seven, missing])
      expect(sevenIndex).toBeGreaterThanOrEqual(0)
      expect(sevenIndex).toBeLessThan(threeIndex)
      expect(threeIndex).toBeLessThan(missingIndex)
    }).toPass()
  })

  test('ao abrir o painel, o filtro de status mostra todos os status e os pedidos dos quatro status aparecem na lista e no mapa', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const pending = await createRescueRequest(request, { requester_name: `E2E Abertura Pendente ${unique}` })
    const inRescue = await createRescueRequest(request, { requester_name: `E2E Abertura Em Resgate ${unique}` })
    const completed = await createRescueRequest(request, { requester_name: `E2E Abertura Concluido ${unique}` })
    const cancelled = await createRescueRequest(request, { requester_name: `E2E Abertura Cancelado ${unique}` })
    await changeRescueRequestStatus(request, inRescue.id, 'assume')
    await changeRescueRequestStatus(request, completed.id, 'assume')
    await changeRescueRequestStatus(request, completed.id, 'complete')
    await changeRescueRequestStatus(request, cancelled.id, 'cancel')

    await page.goto('/painel')

    await expect(page.getByText('Todos os status')).toBeVisible()
    for (const [rescueRequest, label] of [
      [pending, 'Pendente'],
      [inRescue, 'Em resgate'],
      [completed, 'Concluído'],
      [cancelled, 'Cancelado'],
    ] as const) {
      await expect(card(page, rescueRequest.requester_name).getByText(label, { exact: true })).toBeVisible()
      await expect(page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)).toBeVisible()
    }
  })

  test('com filtro de status e de quantidade mínima ao mesmo tempo, só aparecem os pedidos que atendem aos dois', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const matching = `E2E Combinado Pendente Alta ${unique}`
    const lowTotal = `E2E Combinado Pendente Baixa ${unique}`
    const otherStatus = `E2E Combinado Cancelado Alta ${unique}`
    await createRescueRequest(request, { requester_name: matching, total_people: 20 })
    await createRescueRequest(request, { requester_name: lowTotal, total_people: 2 })
    const cancelled = await createRescueRequest(request, { requester_name: otherStatus, total_people: 20 })
    await changeRescueRequestStatus(request, cancelled.id, 'cancel')

    await page.goto('/painel')
    await expect(card(page, otherStatus)).toBeVisible()
    await expect(card(page, lowTotal)).toBeVisible()

    await selectOption(page, 'Status', 'Pendente')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill('10')

    await expect(card(page, matching)).toBeVisible()
    await expect(card(page, lowTotal)).toHaveCount(0)
    await expect(card(page, otherStatus)).toHaveCount(0)
  })

  test('ao abrir o painel, a lista vem ordenada pela data/hora do pedido, do mais recente para o mais antigo', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const older = await createRescueRequest(request, { requester_name: `E2E Abertura Ordem Antigo ${unique}` })
    await waitForNextSecond()
    const newer = await createRescueRequest(request, { requester_name: `E2E Abertura Ordem Recente ${unique}` })

    await page.goto('/painel')

    await expect(page.getByText('Data/hora do pedido')).toBeVisible()
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name])
      expect(newerIndex).toBeGreaterThanOrEqual(0)
      expect(newerIndex).toBeLessThan(olderIndex)
    }).toPass()
  })

  test('mudar a ordenação altera só a lista: os marcadores e a posição do mapa não mudam', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Ordenacao Mapa ${Date.now()}`,
      total_people: 4,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(marker).toBeVisible()
    const positionBefore = await stableBoundingBox(marker)

    const sorted = page.waitForResponse(
      (response) => response.url().includes('sort_by=total_people') && response.request().method() === 'GET',
    )
    await selectOption(page, 'Ordenar por', 'Total de pessoas')
    await sorted

    const positionAfter = await stableBoundingBox(marker)
    expect(positionAfter.x).toBeCloseTo(positionBefore.x, 0)
    expect(positionAfter.y).toBeCloseTo(positionBefore.y, 0)
  })
})
