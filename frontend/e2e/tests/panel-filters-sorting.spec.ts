import { test, expect } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { randomCoordinates, stableBoundingBox } from '../fixtures/map'
import { readAllPagesText, showOneHundredPerPage } from '../fixtures/panel-pages'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

async function selectOption(page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).focus()
  await page.getByRole('combobox', { name: combobox }).press('Enter')
  await page.getByRole('option', { name: option, exact: true }).click()
}

function card(page, name: string) {
  return page.locator('.rescue-requests-list .v-card', { hasText: name })
}

// Posição de cada nome no texto da lista (-1 quando não aparece). Com
// `allPages`, o texto é o da lista inteira, de todas as páginas, na ordem em
// que os pedidos aparecem; sem ele, só o da página aberta.
async function listPositions(page, names: string[], { allPages = false } = {}) {
  const text = allPages ? await readAllPagesText(page) : await page.locator('.rescue-requests-list').innerText()
  return names.map((name) => text.indexOf(name))
}

const INVALID_QUANTITY_MESSAGE = 'Informe um número inteiro de 0 a 999'
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os pedidos.'
const MIN_QUANTITY_LABELS = [
  'Mín. total de pessoas',
  'Mín. homens',
  'Mín. mulheres',
  'Mín. crianças',
  'Mín. idosos',
  'Mín. animais',
]

// Dá ao painel a chance de buscar os pedidos com o filtro digitado (a busca
// espera o operador parar de digitar). Com um valor inválido a busca não deve
// acontecer, então a espera termina sem resposta — e é isso que se quer provar.
async function settleQuantityFilter(page) {
  await page
    .waitForResponse((response) => response.url().includes('/api/rescue-requests?'), { timeout: 2000 })
    .catch(() => null)
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

    // Quantidades altas e próprias deste teste, com um filtro de mínimo: o banco
    // compartilhado tem páginas e mais páginas de pedidos, e a ordenação só pode
    // ser conferida entre os poucos que sobram no filtro.
    const base = 500 + (unique % 400)
    const low = { name: `E2E Ordenacao Baixa ${unique}`, total_people: base }
    const mid = { name: `E2E Ordenacao Media ${unique}`, total_people: base + 4 }
    const high = { name: `E2E Ordenacao Alta ${unique}`, total_people: base + 8 }

    await createRescueRequest(request, { requester_name: low.name, total_people: low.total_people })
    await createRescueRequest(request, { requester_name: mid.name, total_people: mid.total_people })
    await createRescueRequest(request, { requester_name: high.name, total_people: high.total_people })

    await page.goto('/painel')

    await page.getByRole('combobox', { name: 'Ordenar por' }).focus()
    await page.getByRole('combobox', { name: 'Ordenar por' }).press('Enter')
    await page.getByRole('option', { name: 'Total de pessoas' }).click()
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill(String(base))
    // Em ordem crescente o pedido de menor quantidade é o primeiro do filtro; na
    // decrescente (a ordem de abertura) ele pode cair depois da primeira página.
    await page.locator('button:has(i.mdi-sort-ascending)').click()
    await expect(card(page, low.name)).toBeVisible()
    await showOneHundredPerPage(page)

    await expect(async () => {
      const text = await readAllPagesText(page)
      expect(text.indexOf(low.name)).toBeGreaterThanOrEqual(0)
      expect(text.indexOf(low.name)).toBeLessThan(text.indexOf(mid.name))
      expect(text.indexOf(mid.name)).toBeLessThan(text.indexOf(high.name))
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()

    await expect(async () => {
      const text = await readAllPagesText(page)
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
    // Percorre as páginas do resultado filtrado, nas duas direções.
    test.setTimeout(90_000)
    await loginAsAdminMaster()
    const unique = Date.now()
    // Os dois pedidos têm a mesma quantidade de animais, alta e própria deste teste:
    // com o filtro de mínimo de animais, o banco compartilhado (com páginas e mais
    // páginas de pedidos) deixa na lista só os poucos pedidos como eles.
    const animals = 500 + (unique % 400)
    const older = await createRescueRequest(request, { requester_name: `E2E Ordem Data Antigo ${unique}`, animals_count: animals })
    await waitForNextSecond()
    const newer = await createRescueRequest(request, { requester_name: `E2E Ordem Data Recente ${unique}`, animals_count: animals })

    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. animais').fill(String(animals))
    await expect(card(page, newer.requester_name)).toBeVisible()
    await showOneHundredPerPage(page)

    await page.locator('button:has(i.mdi-sort-ascending)').click()
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name], { allPages: true })
      expect(olderIndex).toBeGreaterThanOrEqual(0)
      expect(olderIndex).toBeLessThan(newerIndex)
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name], { allPages: true })
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
    // Percorre as páginas do resultado filtrado, nas duas direções.
    test.setTimeout(90_000)
    await loginAsAdminMaster()
    const unique = Date.now()
    const three = `E2E Nulos Tres ${unique}`
    const seven = `E2E Nulos Sete ${unique}`
    const missing = `E2E Nulos Sem Total ${unique}`
    // Os três pedidos têm a mesma quantidade de animais, alta e própria deste teste:
    // com o filtro de mínimo de animais, o banco compartilhado (com páginas e mais
    // páginas de pedidos) deixa na lista só estes poucos, e a ordenação é conferida
    // entre eles; o pedido sem total fica na última página.
    const animals = 500 + (unique % 400)
    await createRescueRequest(request, { requester_name: three, total_people: 3, animals_count: animals })
    await createRescueRequest(request, { requester_name: missing, animals_count: animals })
    await createRescueRequest(request, { requester_name: seven, total_people: 7, animals_count: animals })

    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. animais').fill(String(animals))
    await expect(card(page, missing)).toBeVisible()
    await showOneHundredPerPage(page)
    await selectOption(page, 'Ordenar por', 'Total de pessoas')

    await page.locator('button:has(i.mdi-sort-ascending)').click()
    await expect(async () => {
      const [threeIndex, sevenIndex, missingIndex] = await listPositions(page, [three, seven, missing], { allPages: true })
      expect(threeIndex).toBeGreaterThanOrEqual(0)
      expect(threeIndex).toBeLessThan(sevenIndex)
      expect(sevenIndex).toBeLessThan(missingIndex)
    }).toPass()

    await page.locator('button:has(i.mdi-sort-descending)').click()
    await expect(async () => {
      const [threeIndex, sevenIndex, missingIndex] = await listPositions(page, [three, seven, missing], { allPages: true })
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
    await showOneHundredPerPage(page)
    await expect(async () => {
      const [olderIndex, newerIndex] = await listPositions(page, [older.requester_name, newer.requester_name])
      expect(newerIndex).toBeGreaterThanOrEqual(0)
      expect(newerIndex).toBeLessThan(olderIndex)
    }).toPass()
  })

  test('mudar a ordenação não reposiciona o mapa: um pedido que continua na página aberta fica no mesmo lugar', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // O mapa mostra os pedidos da página aberta (§4.1): para o pedido continuar
    // na primeira página depois de reordenar, a quantidade é alta e própria deste
    // teste e um filtro de mínimo deixa na lista só os poucos pedidos como ele.
    const total = 500 + (Date.now() % 400)
    // A quantidade de animais, também alta e própria deste teste, mantém o pedido na
    // primeira página mesmo em ordem decrescente: poucos pedidos do banco
    // compartilhado têm as duas quantidades altas.
    const animals = 500 + (Date.now() % 400)
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Ordenacao Mapa ${Date.now()}`,
      total_people: total,
      animals_count: animals,
      ...randomCoordinates(),
    })

    await page.goto('/painel')

    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    await page.getByLabel('Mín. total de pessoas').fill(String(total))
    await page.getByLabel('Mín. animais').fill(String(animals))
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

  test('quantidades mínimas nos extremos da faixa (0 e 999) são aceitas e filtram a lista', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const zeroName = `E2E Filtro Minimo Zero ${unique}`
    const maxName = `E2E Filtro Minimo 999 ${unique}`
    await createRescueRequest(request, { requester_name: zeroName, total_people: 0 })
    await createRescueRequest(request, { requester_name: maxName, total_people: 999 })

    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    const field = page.getByLabel('Mín. total de pessoas')

    await field.fill('0')
    await expect(card(page, zeroName)).toBeVisible()
    await expect(field).not.toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)

    await field.fill('999')
    await expect(card(page, zeroName)).toHaveCount(0)
    await expect(card(page, maxName)).toBeVisible()
    await expect(field).not.toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await expect(page.getByText(LOAD_ERROR_MESSAGE)).toHaveCount(0)
  })

  test('quantidade mínima acima de 999 em qualquer campo mostra a mensagem no próprio campo, sem o alerta de carregamento', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()

    for (const label of MIN_QUANTITY_LABELS) {
      const field = page.getByLabel(label)
      await field.fill('1000')
      await expect(field, label).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
      await field.fill('')
    }

    await page.getByLabel('Mín. total de pessoas').fill('1000')
    await settleQuantityFilter(page)
    await expect(page.getByText(LOAD_ERROR_MESSAGE)).toHaveCount(0)
  })

  test('quantidade mínima negativa mostra a mensagem no próprio campo, sem o alerta de carregamento', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    const field = page.getByLabel('Mín. total de pessoas')

    await field.fill('-1')
    await settleQuantityFilter(page)

    await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await expect(page.getByText(LOAD_ERROR_MESSAGE)).toHaveCount(0)
  })

  test('quantidade mínima com casas decimais mostra a mensagem no próprio campo, sem o alerta de carregamento', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    const field = page.getByLabel('Mín. total de pessoas')

    await field.fill('1.5')
    await settleQuantityFilter(page)

    await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await expect(page.getByText(LOAD_ERROR_MESSAGE)).toHaveCount(0)
  })

  test('enquanto a quantidade mínima é inválida, o mapa e a lista continuam como estavam', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Filtro Invalido Mantem ${Date.now()}`,
      total_people: 5,
    })

    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)
    const marker = page.getByTestId(`rescue-request-marker-${rescueRequest.id}`)
    await expect(rescueCard).toBeVisible()
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()

    // Acima de 999 hoje filtra a lista (some tudo); negativo hoje troca a lista
    // pelo alerta de erro. Nos dois casos a lista deve continuar como estava.
    for (const value of ['1000', '-1']) {
      await page.getByLabel('Mín. total de pessoas').fill(value)
      await settleQuantityFilter(page)

      await expect(rescueCard, value).toBeVisible()
      await expect(marker, value).toBeVisible()
    }
  })

  test('ao corrigir a quantidade mínima inválida ou apagar o campo, a mensagem some e o filtro volta a ser aplicado', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const smallName = `E2E Filtro Corrigido Baixa ${unique}`
    const bigName = `E2E Filtro Corrigido Alta ${unique}`
    await createRescueRequest(request, { requester_name: smallName, total_people: 2 })
    await createRescueRequest(request, { requester_name: bigName, total_people: 20 })

    await page.goto('/painel')
    await page.getByRole('button', { name: 'Filtrar por quantidade' }).click()
    const field = page.getByLabel('Mín. total de pessoas')

    await field.fill('-1')
    await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await field.fill('10')
    await expect(field).not.toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await expect(card(page, smallName)).toHaveCount(0)
    await expect(card(page, bigName)).toBeVisible()

    await field.fill('1.5')
    await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await field.fill('')
    await expect(field).not.toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
    await expect(card(page, smallName)).toBeVisible()
    await expect(card(page, bigName)).toBeVisible()
  })
})
