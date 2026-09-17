import { test, expect } from '@playwright/test'

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
})
