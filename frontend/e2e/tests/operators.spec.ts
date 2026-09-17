import { test, expect } from '../fixtures/auth'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

test.describe('Gestão de operadores', () => {
  test('admin master cadastra um novo operador pela tela', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel/operadores/novo')

    const name = `Operador E2E ${Date.now()}`
    const email = `e2e.operador.${Date.now()}@pontoderesgate.local`

    await page.getByLabel('Nome').fill(name)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill('senha-e2e-123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()

    await expect(page).toHaveURL(/\/painel\/operadores$/)

    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(name)
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(email)
  })

  test('lista de operadores pode ser filtrada por nome e por e-mail', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()

    const unique = Date.now()
    const name = `Operador Filtro ${unique}`
    const email = `e2e.filtro.${unique}@pontoderesgate.local`

    await request.post(`${API_BASE_URL}/api/operators`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name, email, password: 'senha-e2e-123' },
    })

    await page.goto('/painel/operadores')

    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(name)
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(email)

    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill('')
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(email)
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(email)
  })

  test('lista de operadores é paginada', async ({ page, request, loginAsAdminMaster }) => {
    const adminToken = await loginAsAdminMaster()

    const unique = Date.now()
    const namePrefix = `Operador Paginacao ${unique}`

    // Cria 11 operadores com nomes ordenáveis (00 a 10) — a listagem ordena
    // por nome, então a página 1 (10 por página) mostra 00-09 e a página 2
    // mostra só o 10º, de forma determinística.
    for (let i = 0; i <= 10; i += 1) {
      const suffix = String(i).padStart(2, '0')
      await request.post(`${API_BASE_URL}/api/operators`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          name: `${namePrefix} ${suffix}`,
          email: `e2e.paginacao.${unique}.${suffix}@pontoderesgate.local`,
          password: 'senha-e2e-123',
        },
      })
    }

    await page.goto('/painel/operadores')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(namePrefix)

    await expect(page.getByText(`${namePrefix} 00`)).toBeVisible()
    await expect(page.getByText(`${namePrefix} 10`)).not.toBeVisible()

    await page.getByRole('button', { name: 'Next page' }).click()

    await expect(page.getByText(`${namePrefix} 10`)).toBeVisible()
    await expect(page.getByText(`${namePrefix} 00`)).not.toBeVisible()
  })

  test('admin master desativa e reativa um operador pela tela', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()

    const unique = Date.now()
    const name = `Operador Ativacao ${unique}`
    const email = `e2e.ativacao.${unique}@pontoderesgate.local`

    await request.post(`${API_BASE_URL}/api/operators`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name, email, password: 'senha-e2e-123' },
    })

    await page.goto('/painel/operadores')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(name)

    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toContainText('Ativo')

    await row.getByRole('button', { name: 'Desativar' }).click()
    await expect(page.getByText('Operador desativado com sucesso.')).toBeVisible()
    await expect(row).toContainText('Inativo')

    await row.getByRole('button', { name: 'Ativar' }).click()
    await expect(page.getByText('Operador ativado com sucesso.')).toBeVisible()
    await expect(row).toContainText('Ativo')
  })
})
