import { test, expect } from '../fixtures/auth'
import { createRescueRequest } from '../fixtures/rescue-requests'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

test.describe('Painel — gestão de status do pedido', () => {
  test('operador assume um pedido pendente pela UI', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const name = `E2E Assumir ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await expect(card.getByText('Pendente')).toBeVisible()

    await card.getByRole('button', { name: 'Assumir' }).click()

    await expect(card.getByText('Em resgate')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Assumir' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Concluir' })).toBeVisible()
  })

  test('operador conclui um pedido em atendimento pela UI', async ({ page, request, loginAsAdminMaster }) => {
    const adminToken = await loginAsAdminMaster()
    const name = `E2E Concluir ${Date.now()}`
    const rescueRequest = await createRescueRequest(request, { requester_name: name })

    await request.post(`${API_BASE_URL}/api/rescue-requests/${rescueRequest.id}/assume`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await expect(card.getByText('Em resgate')).toBeVisible()

    await card.getByRole('button', { name: 'Concluir' }).click()

    await expect(card.getByText('Concluído')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Concluir' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  })

  test('operador cancela um pedido informando o motivo pela UI', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const name = `E2E Cancelar ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await card.getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDisabled()

    const reason = `Motivo de teste E2E ${Date.now()}`
    await page.getByLabel('Motivo do cancelamento').fill(reason)
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(card.getByText('Cancelado')).toBeVisible()
    await expect(card).toContainText(reason)
  })

  test('compartilhar localização copia a URL para a área de transferência', async ({
    page,
    request,
    context,
    loginAsAdminMaster,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
    // Em ambientes desktop sem integração com o SO, `navigator.share` costuma
    // não existir — força esse caminho para exercitar o fallback de
    // clipboard de forma determinística (a UI já cai nesse fallback sozinha
    // quando `navigator.share` está ausente).
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true })
    })

    await loginAsAdminMaster()
    const name = `E2E Compartilhar ${Date.now()}`
    const rescueRequest = await createRescueRequest(request, { requester_name: name })

    await page.goto('/painel')

    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await card.getByRole('button', { name: 'Compartilhar localização' }).click()

    await expect(page.getByText('Localização copiada para a área de transferência.')).toBeVisible()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain(String(rescueRequest.latitude))
    expect(clipboardText).toContain(String(rescueRequest.longitude))
  })

  test('fluxo completo do painel: operador visualiza, filtra, assume e cancela um pedido', async ({
    page,
    request,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    const name = `E2E Fluxo Completo ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })

    await page.goto('/painel')

    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Pendente', exact: true }).click()

    const card = page.locator('.rescue-requests-list .v-card', { hasText: name })
    await expect(card).toBeVisible()

    // Volta para "Todos os status" antes de agir: assumir o pedido muda seu
    // status para "em_resgate", e a lista é recarregada respeitando o filtro
    // ativo — mantendo o filtro em "Pendente" faria o próprio card sumir da
    // tela assim que a ação fosse concluída.
    await page.getByRole('combobox', { name: 'Status' }).focus()
    await page.getByRole('combobox', { name: 'Status' }).press('Enter')
    await page.getByRole('option', { name: 'Todos os status' }).click()
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Assumir' }).click()
    await expect(card.getByText('Em resgate')).toBeVisible()

    await card.getByRole('button', { name: 'Cancelar' }).click()
    const reason = `Motivo de teste E2E no fluxo completo ${Date.now()}`
    await page.getByLabel('Motivo do cancelamento').fill(reason)
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(card.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(card).toContainText(reason)
  })
})
