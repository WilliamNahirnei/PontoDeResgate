import { test, expect } from '../fixtures/auth'
import { createRescueRequest } from '../fixtures/rescue-requests'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

function waitForLogsResponse(page) {
  return page.waitForResponse(
    (response) => response.url().includes('/api/rescue-status-logs') && response.request().method() === 'GET',
  )
}

test.describe('Tela de logs de auditoria', () => {
  test('exibe o pedido, o operador e a mudança de status de cada log', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()
    const name = `E2E Log ${Date.now()}`
    const rescueRequest = await createRescueRequest(request, { requester_name: name })

    await request.post(`${API_BASE_URL}/api/rescue-requests/${rescueRequest.id}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { cancellation_reason: 'Cancelado para teste E2E de logs.' },
    })

    const logsResponse = waitForLogsResponse(page)
    await page.goto('/painel/logs')
    await logsResponse

    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Pendente')
    await expect(row).toContainText('Cancelado')
  })

  test('lista de logs é paginada', async ({ page, request, loginAsAdminMaster }) => {
    const adminToken = await loginAsAdminMaster()
    const unique = Date.now()
    const names = Array.from({ length: 16 }, (_, index) => `E2E Log Paginacao ${unique} ${index}`)

    for (const name of names) {
      const rescueRequest = await createRescueRequest(request, { requester_name: name })
      await request.post(`${API_BASE_URL}/api/rescue-requests/${rescueRequest.id}/cancel`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { cancellation_reason: 'Cancelado para teste E2E de paginação de logs.' },
      })
    }

    const firstLogsResponse = waitForLogsResponse(page)
    await page.goto('/painel/logs')
    await firstLogsResponse

    const page1Text = await page.locator('table').innerText()

    const nextPageButton = page.getByRole('button', { name: 'Next page' })
    await expect(nextPageButton).toBeEnabled()

    const secondLogsResponse = waitForLogsResponse(page)
    await nextPageButton.click()
    await secondLogsResponse

    const page2Text = await page.locator('table').innerText()
    expect(page2Text).not.toBe(page1Text)

    const combinedText = page1Text + page2Text
    expect(names.some((name) => combinedText.includes(name))).toBe(true)
  })
})
