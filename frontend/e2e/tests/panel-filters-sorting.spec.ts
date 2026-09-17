import { test, expect } from '../fixtures/auth'
import { createRescueRequest } from '../fixtures/rescue-requests'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

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
})
