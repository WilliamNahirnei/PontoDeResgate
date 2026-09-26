import { test, expect } from '../fixtures/auth'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

test.describe('Pedido público de socorro', () => {
  test('cidadão registra um pedido de socorro com sucesso', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Pedido de socorro' })).toBeVisible()

    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
    await expect(page.getByText(/Localização selecionada/)).toBeVisible()

    const requesterName = `E2E teste ${Date.now()}`
    await page.getByLabel('Nome (opcional)').fill(requesterName)
    await page.getByLabel('Total de pessoas').fill('3')
    await page.getByLabel('Ponto de referência (opcional)').fill('Próximo à praça central')

    await page.getByRole('button', { name: 'Enviar pedido' }).click()

    await expect(page.getByText('Pedido enviado com sucesso.')).toBeVisible()
  })

  test('exige localização no mapa antes de enviar', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
  })

  test('posiciona o pin automaticamente via geolocalização do navegador, quando permitida', async ({
    page,
    context,
  }) => {
    const coords = { latitude: -22.9068, longitude: -43.1729 }
    await context.grantPermissions(['geolocation'], { origin: BASE_URL })
    await context.setGeolocation(coords)

    await page.goto('/')

    await expect(page.getByText(new RegExp(`Localização selecionada: ${coords.latitude.toFixed(5)}`))).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
  })

  test('tela pública não exibe link nem referência à área do operador, nem com uma sessão de operador salva', async ({
    page,
    loginAsNewOperator,
  }) => {
    const panelReferences = page.locator('a[href*="painel"], a[href*="login"]')
    const panelTexts = page.getByText(/painel|entrar|login|operador/i)

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Pedido de socorro' })).toBeVisible()
    await expect(panelReferences).toHaveCount(0)
    await expect(panelTexts).toHaveCount(0)

    await loginAsNewOperator()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Pedido de socorro' })).toBeVisible()
    await expect(panelReferences).toHaveCount(0)
    await expect(panelTexts).toHaveCount(0)
  })

  test('com a geolocalização negada, o pin não é posicionado sozinho e a pessoa marca a localização no mapa', async ({
    page,
    context,
  }) => {
    await context.clearPermissions()

    await page.goto('/')

    await expect(page.getByText('Toque no mapa para marcar a localização.', { exact: false })).toBeVisible()
    await expect(page.getByText(/Localização selecionada/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()

    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })

    await expect(page.getByText(/Localização selecionada/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
  })

  test('pin posicionado pela geolocalização pode ser ajustado arrastando o marcador', async ({ page, context }) => {
    const coords = { latitude: -22.9068, longitude: -43.1729 }
    await context.grantPermissions(['geolocation'], { origin: BASE_URL })
    await context.setGeolocation(coords)

    await page.goto('/')

    const initialText = `Localização selecionada: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    await expect(page.getByText(initialText)).toBeVisible()

    const marker = page.locator('.location-picker-map').getByRole('button', { name: 'Marker' })
    const box = await marker.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height + 60, { steps: 10 })
    await page.mouse.up()

    await expect(page.getByText(initialText)).toHaveCount(0)
    await expect(page.getByText(/Localização selecionada: -?\d+\.\d{5}, -?\d+\.\d{5}/)).toBeVisible()
  })

  test('depois do envio, a confirmação não mostra identificador nem status, e "Enviar novo pedido" reabre o formulário vazio', async ({
    page,
  }) => {
    await page.goto('/')

    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
    const requesterName = `E2E Novo Pedido ${Date.now()}`
    await page.getByLabel('Nome (opcional)').fill(requesterName)
    await page.getByLabel('Total de pessoas').fill('4')
    await page.getByLabel('Ponto de referência (opcional)').fill('Ao lado do mercado')
    await page.getByRole('button', { name: 'Enviar pedido' }).click()

    const confirmation = page.getByText('Pedido enviado com sucesso.', { exact: false })
    await expect(confirmation).toBeVisible()
    await expect(page.getByText(/pendente|em resgate|status|protocolo|n[ºo°]\s*\d|#\d/i)).toHaveCount(0)
    await expect(page.getByText(requesterName)).toHaveCount(0)

    await page.getByRole('button', { name: 'Enviar novo pedido' }).click()

    await expect(page.getByText('Toque no mapa para marcar a localização.', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Nome (opcional)')).toHaveValue('')
    await expect(page.getByLabel('Total de pessoas')).toHaveValue('')
    await expect(page.getByLabel('Ponto de referência (opcional)')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
  })

  test('se o envio falhar, a tela mostra a mensagem de erro e mantém os dados preenchidos', async ({ page }) => {
    await page.route('**/api/rescue-requests', (route) =>
      route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
    )

    await page.goto('/')

    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
    const requesterName = `E2E Falha Envio ${Date.now()}`
    await page.getByLabel('Nome (opcional)').fill(requesterName)
    await page.getByLabel('Total de pessoas').fill('2')
    await page.getByRole('button', { name: 'Enviar pedido' }).click()

    await expect(page.getByText('Não foi possível enviar o pedido. Tente novamente.')).toBeVisible()
    await expect(page.getByLabel('Nome (opcional)')).toHaveValue(requesterName)
    await expect(page.getByLabel('Total de pessoas')).toHaveValue('2')
    await expect(page.getByText(/Localização selecionada/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
  })

  test('os dados informados no formulário público aparecem no pedido criado, no painel', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await page.goto('/')

    await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
    const requesterName = `E2E Dados Completos ${Date.now()}`
    await page.getByLabel('Nome (opcional)').fill(requesterName)
    await page.getByLabel('Total de pessoas').fill('5')
    await page.getByLabel('Homens').fill('1')
    await page.getByLabel('Mulheres').fill('2')
    await page.getByLabel('Crianças').fill('1')
    await page.getByLabel('Idosos').fill('1')
    await page.getByLabel('Animais').fill('3')
    await page.getByLabel('Ponto de referência (opcional)').fill('Em frente à escola municipal')
    await page.getByRole('button', { name: 'Enviar pedido' }).click()
    await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()

    await loginAsAdminMaster()
    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: requesterName })
    await expect(card).toBeVisible()
    await expect(card).toContainText('5 pessoa(s)')
    await expect(card).toContainText('3 animal(is)')
    await expect(card).toContainText('Em frente à escola municipal')
    // O requisito (§3.2) não fixa o formato: aceita "Homens: 1", "1 homem" etc.
    await expect(card).toContainText(/homens?\D{0,3}1\b|\b1\D{0,3}homens?/i)
    await expect(card).toContainText(/mulheres?\D{0,3}2\b|\b2\D{0,3}mulheres?/i)
    await expect(card).toContainText(/crianças?\D{0,3}1\b|\b1\D{0,3}crianças?/i)
    await expect(card).toContainText(/idosos?\D{0,3}1\b|\b1\D{0,3}idosos?/i)
  })
})
