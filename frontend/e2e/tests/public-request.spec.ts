import { test, expect } from '../fixtures/auth'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

const QUANTITY_FIELDS = ['Total de pessoas', 'Homens', 'Mulheres', 'Crianças', 'Idosos', 'Animais']
const INVALID_QUANTITY_MESSAGE = 'Informe um número inteiro de 0 a 999'

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function openFormWithLocation(page) {
  await page.goto('/')
  await page.locator('.location-picker-map').click({ position: { x: 150, y: 150 } })
  await expect(page.getByText(/Localização selecionada/)).toBeVisible()
}

// Guarda os envios do pedido, para provar que um formulário inválido não é enviado.
function recordSubmissions(page) {
  const submissions = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/rescue-requests')) {
      submissions.push(request)
    }
  })
  return submissions
}

// Com uma quantidade inválida, a tela pode tanto desabilitar "Enviar pedido" quanto
// recusar o envio no clique; o force mantém o teste válido para as duas formas.
async function trySubmit(page) {
  await page.getByRole('button', { name: 'Enviar pedido' }).click({ force: true })
}

async function openPanelCard(page, loginAsAdminMaster, requesterName: string) {
  await loginAsAdminMaster()
  await page.goto('/painel')
  const card = page.locator('.rescue-requests-list .v-card', { hasText: requesterName })
  await expect(card).toBeVisible()
  return card
}

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

  test.describe('limites dos campos', () => {
    test('quantidades nos extremos da faixa válida (0 e 999) são aceitas e aparecem no painel', async ({
      page,
      loginAsAdminMaster,
    }) => {
      await openFormWithLocation(page)
      const requesterName = `E2E Limites Validos ${uniqueSuffix()}`
      await page.getByLabel('Nome (opcional)').fill(requesterName)
      await page.getByLabel('Total de pessoas').fill('999')
      await page.getByLabel('Homens').fill('0')
      await page.getByLabel('Mulheres').fill('999')
      await page.getByLabel('Crianças').fill('0')
      await page.getByLabel('Idosos').fill('999')
      await page.getByLabel('Animais').fill('999')
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()

      const card = await openPanelCard(page, loginAsAdminMaster, requesterName)
      await expect(card).toContainText('999 pessoa(s)')
      await expect(card).toContainText('999 animal(is)')
      await expect(card).toContainText(/homens?\D{0,3}0\b/i)
      await expect(card).toContainText(/mulheres?\D{0,3}999\b/i)
      await expect(card).toContainText(/crianças?\D{0,3}0\b/i)
      await expect(card).toContainText(/idosos?\D{0,3}999\b/i)
    })

    test('quantidade acima de 999 em qualquer campo mostra a mensagem no próprio campo e o pedido não é enviado', async ({
      page,
    }) => {
      const submissions = recordSubmissions(page)
      await openFormWithLocation(page)

      for (const label of QUANTITY_FIELDS) {
        const field = page.getByLabel(label)
        await field.fill('1000')
        await trySubmit(page)

        await expect(field, label).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
        expect(submissions, label).toHaveLength(0)
        await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toHaveCount(0)

        await field.fill('')
      }
    })

    test('quantidade negativa mostra a mensagem no próprio campo e o pedido não é enviado', async ({ page }) => {
      const submissions = recordSubmissions(page)
      await openFormWithLocation(page)

      const field = page.getByLabel('Homens')
      await field.fill('-5')
      await trySubmit(page)

      await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
      expect(submissions).toHaveLength(0)
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toHaveCount(0)
    })

    test('quantidade com casas decimais mostra a mensagem no próprio campo e o pedido não é enviado', async ({
      page,
    }) => {
      const submissions = recordSubmissions(page)
      await openFormWithLocation(page)

      // O campo é numérico: o navegador aceita o decimal com ponto.
      const field = page.getByLabel('Crianças')
      await field.fill('1.5')
      await trySubmit(page)

      await expect(field).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
      expect(submissions).toHaveLength(0)
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toHaveCount(0)
    })

    test('depois de corrigir a quantidade inválida ou apagar o campo, a mensagem some e o pedido é enviado', async ({
      page,
    }) => {
      await openFormWithLocation(page)
      await page.getByLabel('Nome (opcional)').fill(`E2E Corrige Quantidade ${uniqueSuffix()}`)
      const total = page.getByLabel('Total de pessoas')
      const animals = page.getByLabel('Animais')
      await total.fill('1000')
      await animals.fill('-1')
      await trySubmit(page)
      await expect(total).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)
      await expect(animals).toHaveAccessibleDescription(INVALID_QUANTITY_MESSAGE)

      await total.fill('10')
      await animals.fill('')

      await expect(page.getByText(INVALID_QUANTITY_MESSAGE)).toHaveCount(0)
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()
    })

    test('quantidade em branco é tratada como não informada e zero como informado, no card do painel', async ({
      page,
      loginAsAdminMaster,
    }) => {
      await openFormWithLocation(page)
      const requesterName = `E2E Branco Zero ${uniqueSuffix()}`
      await page.getByLabel('Nome (opcional)').fill(requesterName)
      await page.getByLabel('Homens').fill('0')
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()

      const card = await openPanelCard(page, loginAsAdminMaster, requesterName)
      await expect(card).toContainText(/homens?\D{0,3}0\b/i)
      await expect(card).not.toContainText(/mulher/i)
    })

    test('o campo de nome mostra quantos caracteres já foram usados de 255 e não aceita além disso', async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
      await page.goto('/')
      const field = page.getByLabel('Nome (opcional)')
      await expect(page.getByText(/^\s*0\s*(\/|de)\s*255\s*$/)).toBeVisible()

      // Digitado: com 254 caracteres no campo, só o próximo caractere digitado entra.
      const typedPrefix = 'n'.repeat(254)
      await field.fill(typedPrefix)
      await field.pressSequentially('XY')
      await expect(field).toHaveValue(`${typedPrefix}X`)
      await expect(page.getByText(/^\s*255\s*(\/|de)\s*255\s*$/)).toBeVisible()

      // Colado: um texto de 256 caracteres colado pela área de transferência para no 255º.
      const pasted = 'p'.repeat(255)
      await field.fill('')
      await page.evaluate((text) => navigator.clipboard.writeText(text), `${pasted}Z`)
      await field.press('ControlOrMeta+V')
      await expect(field).toHaveValue(pasted)
    })

    test('o campo de ponto de referência mostra quantos caracteres já foram usados de 1000 e não aceita além disso', async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
      await page.goto('/')
      const field = page.getByLabel('Ponto de referência (opcional)')
      await expect(page.getByText(/^\s*0\s*(\/|de)\s*1000\s*$/)).toBeVisible()

      // Digitado: com 999 caracteres no campo, só o próximo caractere digitado entra.
      const typedPrefix = 'r'.repeat(999)
      await field.fill(typedPrefix)
      await field.pressSequentially('XY')
      await expect(field).toHaveValue(`${typedPrefix}X`)
      await expect(page.getByText(/^\s*1000\s*(\/|de)\s*1000\s*$/)).toBeVisible()

      // Colado: um texto de 1001 caracteres colado pela área de transferência para no 1000º.
      const pasted = 'p'.repeat(1000)
      await field.fill('')
      await page.evaluate((text) => navigator.clipboard.writeText(text), `${pasted}Z`)
      await field.press('ControlOrMeta+V')
      await expect(field).toHaveValue(pasted)
    })

    test('nome com 255 caracteres e ponto de referência com 1000 são aceitos e aparecem completos no painel', async ({
      page,
      loginAsAdminMaster,
    }) => {
      await openFormWithLocation(page)
      const unique = uniqueSuffix()
      const requesterName = `E2E Nome 255 ${unique} `.padEnd(255, 'n')
      const referencePoint = `Referencia 1000 ${unique} `.padEnd(1000, 'r')
      await page.getByLabel('Nome (opcional)').fill(requesterName)
      await page.getByLabel('Ponto de referência (opcional)').fill(referencePoint)
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()

      const card = await openPanelCard(page, loginAsAdminMaster, requesterName)
      await expect(card).toContainText(requesterName)
      await expect(card).toContainText(referencePoint)
    })

    test('total de pessoas diferente da soma das categorias é aceito e aparece como foi informado', async ({
      page,
      loginAsAdminMaster,
    }) => {
      await openFormWithLocation(page)
      const requesterName = `E2E Total Diferente ${uniqueSuffix()}`
      await page.getByLabel('Nome (opcional)').fill(requesterName)
      await page.getByLabel('Total de pessoas').fill('2')
      await page.getByLabel('Homens').fill('5')
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await expect(page.getByText('Pedido enviado com sucesso.', { exact: false })).toBeVisible()

      const card = await openPanelCard(page, loginAsAdminMaster, requesterName)
      await expect(card).toContainText('2 pessoa(s)')
      await expect(card).toContainText(/homens?\D{0,3}5\b/i)
    })
  })
})
