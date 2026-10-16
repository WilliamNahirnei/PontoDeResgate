import { test, expect } from '../fixtures/auth'
import { adminMasterToken, createOperator } from '../fixtures/operators'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

const EMAIL_TAKEN_MESSAGE = 'Este e-mail já está cadastrado.'
const SHORT_PASSWORD_MESSAGE = 'A senha deve ter pelo menos 8 caracteres.'

async function fillOperatorForm(page, data: { name: string; email: string; password: string }) {
  await page.goto('/painel/operadores/novo')
  await page.getByLabel('Nome').fill(data.name)
  await page.getByLabel('E-mail').fill(data.email)
  await page.getByLabel('Senha').fill(data.password)
  await page.getByRole('button', { name: 'Cadastrar' }).click()
}

async function operatorsByEmail(request, adminToken: string, email: string) {
  const response = await request.get(`${API_BASE_URL}/api/operators`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    params: { email },
  })

  return (await response.json()).data
}

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

  test('filtros por nome e por e-mail mostram só o operador correspondente', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()

    const unique = Date.now()
    const namePrefix = `Operador Filtro ${unique}`
    const operatorA = { name: `${namePrefix} A`, email: `e2e.filtro.${unique}.a@pontoderesgate.local` }
    const operatorB = { name: `${namePrefix} B`, email: `e2e.filtro.${unique}.b@pontoderesgate.local` }

    for (const operator of [operatorA, operatorB]) {
      await request.post(`${API_BASE_URL}/api/operators`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { ...operator, password: 'senha-e2e-123' },
      })
    }

    await page.goto('/painel/operadores')

    const nameFilter = page.getByRole('textbox', { name: 'Filtrar por nome' })
    const rowA = page.getByRole('row', { name: new RegExp(operatorA.name) })
    const rowB = page.getByRole('row', { name: new RegExp(operatorB.name) })

    // Parte de um recorte em que os dois aparecem (a lista é paginada e o
    // banco acumula operadores de outras execuções): sem isso, o "some da
    // lista" abaixo passaria mesmo com o filtro quebrado.
    await nameFilter.fill(namePrefix)
    await expect(rowA).toBeVisible()
    await expect(rowB).toBeVisible()

    await nameFilter.fill(operatorA.name)
    await expect(rowB).toHaveCount(0)
    await expect(rowA).toContainText(operatorA.email)

    await nameFilter.fill(namePrefix)
    await expect(rowB).toBeVisible()
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(operatorB.email)
    await expect(rowA).toHaveCount(0)
    await expect(rowB).toContainText(operatorB.email)
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

    await page.getByRole('button', { name: 'Próxima página' }).click()

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

  test('cadastro com o e-mail de um operador ativo mostra "Este e-mail já está cadastrado." no campo de e-mail e mantém o formulário', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const existing = await createOperator(request)

    await page.goto('/painel/operadores/novo')

    const name = `Operador Duplicado ${Date.now()}`
    await page.getByLabel('Nome').fill(name)
    await page.getByLabel('E-mail').fill(existing.email)
    await page.getByLabel('Senha').fill('senha-e2e-123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()

    await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page.getByText(EMAIL_TAKEN_MESSAGE)).toHaveCount(1)
    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)
    await expect(page.getByLabel('Nome')).toHaveValue(name)
    await expect(page.getByLabel('E-mail')).toHaveValue(existing.email)
  })

  test('cadastro sem nome, sem e-mail, sem senha ou com senha fraca mostra erro e não cadastra o operador', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const adminToken = await adminMasterToken(request)
    const unique = Date.now()

    const cases = [
      { field: 'Nome', data: { name: '', email: `e2e.semnome.${unique}@pontoderesgate.local`, password: 'senha-e2e-123' } },
      { field: 'E-mail', data: { name: `Operador Sem Email ${unique}`, email: '', password: 'senha-e2e-123' } },
      { field: 'Senha', data: { name: `Operador Sem Senha ${unique}`, email: `e2e.semsenha.${unique}@pontoderesgate.local`, password: '' } },
      { field: null, data: { name: `Operador Senha Fraca ${unique}`, email: `e2e.senhafraca.${unique}@pontoderesgate.local`, password: '123' } },
    ]

    for (const { field, data } of cases) {
      await page.goto('/painel/operadores/novo')
      await page.getByLabel('Nome').fill(data.name)
      await page.getByLabel('E-mail').fill(data.email)
      await page.getByLabel('Senha').fill(data.password)
      await page.getByRole('button', { name: 'Cadastrar' }).click()

      if (field) {
        // Campo obrigatório vazio: o navegador bloqueia o envio e mostra a
        // mensagem de validação nativa do campo.
        const validationMessage = await page.getByLabel(field).evaluate((input: HTMLInputElement) => input.validationMessage)
        expect(validationMessage).not.toBe('')
      } else {
        await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()
      }
      await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)

      const lookup = data.email || data.name
      const response = await request.get(`${API_BASE_URL}/api/operators`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: data.email ? { email: data.email } : { name: data.name },
      })
      const body = await response.json()
      expect(body.data, `não deveria ter cadastrado ${lookup}`).toHaveLength(0)
    }
  })

  test('operador recém-cadastrado entra com a senha do cadastro e vê o painel sem os itens de menu de admin master', async ({
    page,
    browser,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel/operadores/novo')

    const unique = Date.now()
    const operator = {
      name: `Operador Novo ${unique}`,
      email: `e2e.novo.${unique}@pontoderesgate.local`,
      password: 'senha-e2e-123',
    }
    await page.getByLabel('Nome').fill(operator.name)
    await page.getByLabel('E-mail').fill(operator.email)
    await page.getByLabel('Senha').fill(operator.password)
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(page).toHaveURL(/\/painel\/operadores$/)

    // Outro contexto, sem a sessão do admin master injetada.
    const operatorContext = await browser.newContext({ baseURL: BASE_URL })
    const operatorPage = await operatorContext.newPage()
    await operatorPage.goto('/login')
    await operatorPage.getByLabel('E-mail').fill(operator.email)
    await operatorPage.getByLabel('Senha').fill(operator.password)
    await operatorPage.getByRole('button', { name: 'Entrar' }).click()

    await expect(operatorPage.getByRole('heading', { name: 'Pedidos de resgate' })).toBeVisible()
    await expect(operatorPage.getByText(operator.name)).toBeVisible()
    await expect(operatorPage.getByRole('link', { name: 'Painel' })).toBeVisible()
    await expect(operatorPage.getByRole('link', { name: 'Operadores' })).toHaveCount(0)
    await expect(operatorPage.getByRole('link', { name: 'Logs' })).toHaveCount(0)

    await operatorContext.close()
  })

  test('a lista mostra só operadores, nunca o admin master, em ordem alfabética de nome', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const namePrefix = `Operador Ordem ${unique}`
    // Cadastrados fora de ordem, para a ordenação não vir de graça.
    for (const suffix of ['C', 'A', 'B']) {
      await createOperator(request, { name: `${namePrefix} ${suffix}` })
    }

    await page.goto('/painel/operadores')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(namePrefix)

    await expect(page.getByRole('row', { name: new RegExp(`${namePrefix} C`) })).toBeVisible()
    const rowNames = await page.getByRole('row').filter({ hasText: namePrefix }).allInnerTexts()
    expect(rowNames.map((text) => text.match(new RegExp(`${namePrefix} ([ABC])`))?.[1])).toEqual(['A', 'B', 'C'])

    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill('')
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill('admin@pontoderesgate.local')
    await expect(page.getByText('Nenhum operador encontrado.')).toBeVisible()
  })

  test('filtros de nome e de e-mail combinados; sem correspondência a lista mostra "Nenhum operador encontrado."', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const namePrefix = `Operador Combinado ${unique}`
    const operatorA = await createOperator(request, { name: `${namePrefix} A`, email: `e2e.combinado.${unique}.a@pontoderesgate.local` })
    const operatorB = await createOperator(request, { name: `${namePrefix} B`, email: `e2e.combinado.${unique}.b@pontoderesgate.local` })

    await page.goto('/painel/operadores')

    const rowA = page.getByRole('row', { name: new RegExp(operatorA.name) })
    const rowB = page.getByRole('row', { name: new RegExp(operatorB.name) })

    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(namePrefix)
    await expect(rowA).toBeVisible()
    await expect(rowB).toBeVisible()

    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(operatorB.email)
    await expect(rowA).toHaveCount(0)
    await expect(rowB).toBeVisible()

    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(`e2e.inexistente.${unique}@pontoderesgate.local`)
    await expect(page.getByText('Nenhum operador encontrado.')).toBeVisible()
    await expect(rowB).toHaveCount(0)
  })

  test('o botão "Novo operador" da lista leva ao formulário de cadastro', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel/operadores')

    await page.getByRole('link', { name: 'Novo operador' }).click()

    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)
    await expect(page.getByRole('button', { name: 'Cadastrar' })).toBeVisible()
  })

  test('cadastro com senha de menos de 8 caracteres mostra "A senha deve ter pelo menos 8 caracteres." no campo de senha e não cadastra o operador', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()
    const email = `e2e.senhacurta.${Date.now()}@pontoderesgate.local`

    await fillOperatorForm(page, { name: `Operador Senha Curta ${Date.now()}`, email, password: 'abc1234' })

    await expect(page.getByLabel('Senha')).toHaveAccessibleDescription(SHORT_PASSWORD_MESSAGE)
    await expect(page.getByText(SHORT_PASSWORD_MESSAGE)).toHaveCount(1)
    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)
    expect(await operatorsByEmail(request, adminToken, email)).toHaveLength(0)
  })

  test('cadastro com senha de exatamente 8 caracteres é aceito e o operador aparece na lista', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const name = `Operador Senha Oito ${Date.now()}`

    await fillOperatorForm(page, { name, email: `e2e.senhaoito.${Date.now()}@pontoderesgate.local`, password: 'abcd1234' })

    await expect(page).toHaveURL(/\/painel\/operadores$/)
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(name)
    await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible()
  })

  test('cadastro com o e-mail de um operador desativado mostra "Este e-mail já está cadastrado." no campo de e-mail e não cadastra o operador', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()
    const deactivated = await createOperator(request)
    await request.post(`${API_BASE_URL}/api/operators/${deactivated.id}/deactivate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    await fillOperatorForm(page, { name: `Operador Duplicado ${Date.now()}`, email: deactivated.email, password: 'senha-e2e-123' })

    await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page.getByText(EMAIL_TAKEN_MESSAGE)).toHaveCount(1)
    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)
    expect(await operatorsByEmail(request, adminToken, deactivated.email)).toHaveLength(1)
  })

  test('cadastro com e-mail já cadastrado e senha curta ao mesmo tempo mostra cada mensagem no seu campo, sem "(e mais 1 erro)"', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    const adminToken = await loginAsAdminMaster()
    const existing = await createOperator(request)

    await fillOperatorForm(page, { name: `Operador Dois Erros ${Date.now()}`, email: existing.email, password: 'abc1234' })

    await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page.getByLabel('Senha')).toHaveAccessibleDescription(SHORT_PASSWORD_MESSAGE)
    await expect(page.getByText(EMAIL_TAKEN_MESSAGE)).toHaveCount(1)
    await expect(page.getByText(SHORT_PASSWORD_MESSAGE)).toHaveCount(1)
    await expect(page.getByText(/\(e mais \d+ erros?\)/)).toHaveCount(0)
    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)
    expect(await operatorsByEmail(request, adminToken, existing.email)).toHaveLength(1)
  })

  test('com os dois erros na tela, corrigir só um e enviar de novo faz sumir a mensagem desse campo e mantém a do outro', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const existing = await createOperator(request)

    await fillOperatorForm(page, { name: `Operador Corrige Um ${Date.now()}`, email: existing.email, password: 'abc1234' })
    await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page.getByLabel('Senha')).toHaveAccessibleDescription(SHORT_PASSWORD_MESSAGE)

    // Corrige o e-mail: a mensagem dele some e a da senha continua.
    await page.getByLabel('E-mail').fill(`e2e.corrigido.${Date.now()}@pontoderesgate.local`)
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(page.getByLabel('Senha')).toHaveAccessibleDescription(SHORT_PASSWORD_MESSAGE)
    await expect(page.getByLabel('E-mail')).not.toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page).toHaveURL(/\/painel\/operadores\/novo$/)

    // Volta ao e-mail repetido e corrige a senha: a mensagem dela some e a do e-mail volta.
    await page.getByLabel('E-mail').fill(existing.email)
    await page.getByLabel('Senha').fill('senha-e2e-123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(EMAIL_TAKEN_MESSAGE)
    await expect(page.getByLabel('Senha')).not.toHaveAccessibleDescription(SHORT_PASSWORD_MESSAGE)
  })

  test('a paginação da lista de operadores aparece em português, com os botões de página nomeados em português', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    await page.goto('/painel/operadores')

    // O banco compartilhado sempre tem mais de uma página de operadores.
    await expect(page.getByText(/^\d+-\d+ de \d+$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeVisible()
  })

  test('o botão de limpar dos filtros de nome e de e-mail tem nome em português', async ({ page, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    await page.goto('/painel/operadores')

    // O botão de limpar só aparece com o campo preenchido.
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill('Operador')
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill('operador')

    await expect(page.getByRole('button', { name: 'Limpar Filtrar por nome' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Limpar Filtrar por e-mail' })).toBeVisible()
  })

  test('enquanto a lista de operadores carrega, o texto de carregamento aparece em português', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // Segura a resposta da lista para a tela ficar no estado de carregamento,
    // ainda sem nenhum operador.
    let releaseList: () => void = () => {}
    const listHeld = new Promise<void>((resolve) => {
      releaseList = resolve
    })
    await page.route('**/api/operators?**', async (route) => {
      await listHeld
      await route.continue()
    })

    await page.goto('/painel/operadores')

    await expect(page.getByText('Carregando itens...')).toBeVisible()
    releaseList()
  })
})
