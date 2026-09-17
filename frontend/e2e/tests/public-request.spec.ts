import { test, expect } from '@playwright/test'

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
})
