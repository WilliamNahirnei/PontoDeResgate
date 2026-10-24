import { test, expect, injectSession } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { adminMasterToken, createOperator, loginViaApi } from '../fixtures/operators'
import { completeThroughDialog, holdStatusAction } from '../fixtures/status-actions'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

// Abre a tela de logs mostrando 100 por página: a lista vem do mais recente
// para o mais antigo, e outros testes rodando em paralelo criam logs que
// empurrariam a linha deste teste para fora da primeira página de 15.
async function openLogs(page) {
  const firstPage = waitForLogsResponse(page)
  await page.goto('/painel/logs')
  await firstPage

  const biggerPage = page.waitForResponse(
    (response) => response.url().includes('/api/rescue-status-logs') && response.url().includes('per_page=100'),
  )
  await page.getByRole('combobox', { name: 'Logs por página' }).focus()
  await page.getByRole('combobox', { name: 'Logs por página' }).press('Enter')
  await page.getByRole('option', { name: '100', exact: true }).click()
  await biggerPage
}

function logRows(page, requesterName: string) {
  return page.getByRole('row').filter({ hasText: requesterName })
}

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

    const nextPageButton = page.getByRole('button', { name: 'Próxima página' })
    await expect(nextPageButton).toBeEnabled()

    const secondLogsResponse = waitForLogsResponse(page)
    await nextPageButton.click()
    await secondLogsResponse

    const page2Text = await page.locator('table').innerText()
    expect(page2Text).not.toBe(page1Text)

    const combinedText = page1Text + page2Text
    expect(names.some((name) => combinedText.includes(name))).toBe(true)
  })

  test('cada linha da tela de logs mostra o operador responsável e a data/hora da mudança', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const operator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Log Operador ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', operator.token)

    const logsResponse = await request.get(`${API_BASE_URL}/api/rescue-status-logs`, {
      headers: { Authorization: `Bearer ${await adminMasterToken(request)}` },
      params: { per_page: 100 },
    })
    const log = (await logsResponse.json()).data.find((item) => item.rescue_request.id === rescueRequest.id)

    await openLogs(page)

    const row = logRows(page, rescueRequest.requester_name)
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(operator.name)
    await expect(row).toContainText(await page.evaluate((isoDate) => new Date(isoDate).toLocaleString('pt-BR'), log.created_at))
  })

  test('na disputa por um pedido, a tentativa recusada do segundo operador não gera entrada na tela de logs', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const firstOperator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Log Disputa ${Date.now()}` })

    // O admin master é o segundo operador: abre o painel com o pedido ainda pendente.
    await page.goto('/painel')
    const rescueCard = page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
    await expect(rescueCard.getByRole('button', { name: 'Assumir' })).toBeVisible()

    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', firstOperator.token)

    const assumeAttempt = page.waitForResponse((response) => response.url().includes(`/rescue-requests/${rescueRequest.id}/assume`))
    await rescueCard.getByRole('button', { name: 'Assumir' }).click()
    await assumeAttempt

    await openLogs(page)

    const rows = logRows(page, rescueRequest.requester_name)
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText(firstOperator.name)
    await expect(rows).toContainText('Pendente')
    await expect(rows).toContainText('Em resgate')
  })

  test('depois de um duplo clique em Assumir, Concluir ou Confirmar cancelamento, a tela de logs mostra uma única entrada por mudança', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const toFinish = await createRescueRequest(request, { requester_name: `E2E Log Duplo Concluir ${unique}` })
    const toCancel = await createRescueRequest(request, { requester_name: `E2E Log Duplo Cancelar ${unique}` })
    const toFinishCard = page.locator('.rescue-requests-list .v-card', { hasText: toFinish.requester_name })
    const toCancelCard = page.locator('.rescue-requests-list .v-card', { hasText: toCancel.requester_name })
    await page.goto('/painel')

    // Cada ação fica segurada até o duplo clique terminar, para o segundo clique
    // acontecer com a primeira ação ainda em andamento.
    const assume = await holdStatusAction(page, toFinish.id, 'assume')
    await toFinishCard.getByRole('button', { name: 'Assumir' }).dblclick()
    await assume.releaseAndWait()
    await expect(toFinishCard.getByText('Em resgate', { exact: true })).toBeVisible()

    const complete = await holdStatusAction(page, toFinish.id, 'complete')
    await toFinishCard.getByRole('button', { name: 'Concluir' }).click()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).dblclick()
    await complete.releaseAndWait()
    await expect(toFinishCard.getByText('Concluído', { exact: true })).toBeVisible()

    await toCancelCard.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('Duplo clique ao confirmar.')
    const cancel = await holdStatusAction(page, toCancel.id, 'cancel')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).dblclick()
    await cancel.releaseAndWait()
    await expect(toCancelCard.getByText('Cancelado', { exact: true })).toBeVisible()

    await openLogs(page)

    const toFinishRows = logRows(page, toFinish.requester_name)
    await expect(toFinishRows).toHaveCount(2)
    await expect(toFinishRows.filter({ hasText: 'Concluído' })).toHaveCount(1)
    const toCancelRows = logRows(page, toCancel.requester_name)
    await expect(toCancelRows).toHaveCount(1)
    await expect(toCancelRows).toContainText('Cancelado')
  })

  test('usar "Compartilhar localização" em um pedido não gera entrada na tela de logs', async ({
    page,
    request,
    context,
    loginAsAdminMaster,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true })
    })
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Log Compartilhar ${Date.now()}` })

    await page.goto('/painel')
    await page
      .locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name })
      .getByRole('button', { name: 'Compartilhar localização' })
      .click()
    await expect(page.getByText('Localização copiada para a área de transferência.')).toBeVisible()

    await openLogs(page)
    await expect(logRows(page, rescueRequest.requester_name)).toHaveCount(0)

    // Controle: uma mudança de status do mesmo pedido aparece na mesma tela,
    // então a ausência acima não é só a tela deixando de listar o pedido.
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    await openLogs(page)
    await expect(logRows(page, rescueRequest.requester_name)).toHaveCount(1)
  })

  test('depois de um operador assumir, concluir e cancelar pela UI, o admin master vê cada mudança nos logs com o operador que agiu', async ({
    page,
    request,
    browser,
    loginAsNewOperator,
  }) => {
    const operator = await loginAsNewOperator()
    const unique = Date.now()
    const completed = await createRescueRequest(request, { requester_name: `E2E Auditoria Concluido ${unique}` })
    const cancelled = await createRescueRequest(request, { requester_name: `E2E Auditoria Cancelado ${unique}` })

    await page.goto('/painel')
    const completedCard = page.locator('.rescue-requests-list .v-card', { hasText: completed.requester_name })
    await completedCard.getByRole('button', { name: 'Assumir' }).click()
    await expect(completedCard.getByRole('button', { name: 'Concluir' })).toBeVisible()
    await completeThroughDialog(page, completedCard)
    await expect(completedCard.getByText('Concluído', { exact: true })).toBeVisible()

    const cancelledCard = page.locator('.rescue-requests-list .v-card', { hasText: cancelled.requester_name })
    await cancelledCard.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('Cancelado no teste de auditoria E2E.')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(cancelledCard.getByText('Cancelado', { exact: true })).toBeVisible()

    // Segunda sessão: o admin master, em outro contexto de navegador.
    const admin = await loginViaApi(request, 'admin@pontoderesgate.local', 'password')
    const adminContext = await browser.newContext({ baseURL: BASE_URL })
    const adminPage = await adminContext.newPage()
    await injectSession(adminPage, admin.token, admin.user)
    await openLogs(adminPage)

    const completedRows = logRows(adminPage, completed.requester_name)
    await expect(completedRows).toHaveCount(2)
    await expect(completedRows.filter({ hasText: /Pendente[\s\S]*Em resgate/ })).toContainText(operator.name)
    await expect(completedRows.filter({ hasText: /Em resgate[\s\S]*Concluído/ })).toContainText(operator.name)

    const cancelledRows = logRows(adminPage, cancelled.requester_name)
    await expect(cancelledRows).toHaveCount(1)
    await expect(cancelledRows).toContainText(/Pendente[\s\S]*Cancelado/)
    await expect(cancelledRows).toContainText(operator.name)

    await adminContext.close()
  })

  test('desativar um operador que já atendeu pedidos não apaga o histórico no card nem na tela de logs', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const operator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Historico ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', operator.token)

    await page.goto('/painel/operadores')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(operator.name)
    const operatorRow = page.getByRole('row', { name: new RegExp(operator.name) })
    await operatorRow.getByRole('button', { name: 'Desativar' }).click()
    await expect(operatorRow).toContainText('Inativo')

    await page.goto('/painel')
    await expect(
      page.locator('.rescue-requests-list .v-card', { hasText: rescueRequest.requester_name }),
    ).toContainText(`Operador responsável: ${operator.name}`)

    await openLogs(page)
    await expect(logRows(page, rescueRequest.requester_name)).toContainText(operator.name)
  })

  test('a paginação da tela de logs aparece em português, com os botões de página nomeados em português', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const logsResponse = waitForLogsResponse(page)
    await page.goto('/painel/logs')
    await logsResponse

    // O banco compartilhado sempre tem mais de uma página de logs.
    await expect(page.getByText(/^\d+-\d+ de \d+$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeVisible()
  })

  test('enquanto a tela de logs carrega, o texto de carregamento aparece em português', async ({
    page,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    // Segura a resposta dos logs para a tela ficar no estado de carregamento,
    // ainda sem nenhum log.
    let releaseLogs: () => void = () => {}
    const logsHeld = new Promise<void>((resolve) => {
      releaseLogs = resolve
    })
    await page.route('**/api/rescue-status-logs?**', async (route) => {
      await logsHeld
      await route.continue()
    })

    await page.goto('/painel/logs')

    await expect(page.getByText('Carregando itens...')).toBeVisible()
    releaseLogs()
  })

  // Prepara pedidos já finalizados por API: assumidos por um operador novo e
  // concluídos (com ou sem observação) ou cancelados.
  async function finishRequest(request, label: string, finish: { note?: string } | { reason: string } | 'complete') {
    const operator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, {
      requester_name: `E2E Log ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', operator.token)
    if (finish === 'complete') {
      await changeRescueRequestStatus(request, rescueRequest.id, 'complete', operator.token)
    } else if ('reason' in finish) {
      await changeRescueRequestStatus(request, rescueRequest.id, 'cancel', operator.token, {
        cancellation_reason: finish.reason,
      })
    } else {
      await changeRescueRequestStatus(request, rescueRequest.id, 'complete', operator.token, {
        completion_note: finish.note,
      })
    }

    return { rescueRequest, operator }
  }

  const completionRow = (page, name: string) => logRows(page, name).filter({ hasText: /Em resgate[\s\S]*Concluído/ })

  test('a entrada da conclusão com observação tem um ícone que abre a janela "Observação da conclusão" com o texto, o pedido, o operador e a data/hora', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const note = `Família resgatada em segurança ${Date.now()}.`
    const { rescueRequest, operator } = await finishRequest(request, 'Obs Conclusao', { note })

    await openLogs(page)
    await completionRow(page, rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Observação da conclusão', { exact: true })).toBeVisible()
    await expect(dialog).toContainText(note)
    await expect(dialog).toContainText(rescueRequest.requester_name)
    await expect(dialog).toContainText(operator.name)
    await expect(dialog).toContainText(/Data\/hora:?\s*\d{2}\/\d{2}\/\d{4}/)
  })

  test('a entrada da conclusão sem observação informada não tem o ícone de observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const { rescueRequest } = await finishRequest(request, 'Sem Obs', 'complete')

    await openLogs(page)

    await expect(completionRow(page, rescueRequest.requester_name)).toHaveCount(1)
    await expect(logRows(page, rescueRequest.requester_name).getByRole('button', { name: /^Ver (observação|motivo)/ })).toHaveCount(0)
  })

  test('num pedido assumido e depois concluído com observação, só a entrada da conclusão tem o ícone; a de assumir não', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const { rescueRequest } = await finishRequest(request, 'Assumir E Concluir', { note: 'Observação da conclusão do teste.' })

    await openLogs(page)

    const rows = logRows(page, rescueRequest.requester_name)
    await expect(rows).toHaveCount(2)
    await expect(completionRow(page, rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true })).toHaveCount(1)
    const assumeRow = rows.filter({ hasText: /Pendente[\s\S]*Em resgate/ })
    await expect(assumeRow).toHaveCount(1)
    await expect(assumeRow.getByRole('button', { name: /^Ver (observação|motivo)/ })).toHaveCount(0)
  })

  test('a entrada de cancelamento tem um ícone que abre a janela "Motivo do cancelamento" com o motivo, o pedido, o operador e a data/hora', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const reason = `Endereço não encontrado ${Date.now()}.`
    const { rescueRequest, operator } = await finishRequest(request, 'Motivo', { reason })

    await openLogs(page)
    await logRows(page, rescueRequest.requester_name)
      .filter({ hasText: /Em resgate[\s\S]*Cancelado/ })
      .getByRole('button', { name: 'Ver motivo do cancelamento', exact: true })
      .click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Motivo do cancelamento', { exact: true })).toBeVisible()
    await expect(dialog).toContainText(reason)
    await expect(dialog).toContainText(rescueRequest.requester_name)
    await expect(dialog).toContainText(operator.name)
    await expect(dialog).toContainText(/Data\/hora:?\s*\d{2}\/\d{2}\/\d{4}/)
  })

  test('a linha do log não exibe o texto do motivo do cancelamento nem o da observação da conclusão: ele só aparece na janela', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const note = `Observação só na janela ${unique}.`
    const reason = `Motivo só na janela ${unique}.`
    const completed = await finishRequest(request, 'Linha Obs', { note })
    const cancelled = await finishRequest(request, 'Linha Motivo', { reason })

    await openLogs(page)

    // O ícone existe (a observação foi gravada), mas o texto não está na tabela.
    await expect(completionRow(page, completed.rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true })).toBeVisible()
    await expect(logRows(page, cancelled.rescueRequest.requester_name).getByRole('button', { name: 'Ver motivo do cancelamento', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).not.toContainText(note)
    await expect(page.getByRole('table')).not.toContainText(reason)
  })

  test('fechar a janela do ícone pelo botão de fechar a esconde, e a tela de logs continua com as mesmas entradas', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const { rescueRequest } = await finishRequest(request, 'Fechar', { note: 'Observação para fechar.' })

    await openLogs(page)
    const rows = logRows(page, rescueRequest.requester_name)
    await expect(rows).toHaveCount(2)
    await completionRow(page, rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(rows).toHaveCount(2)
    await expect(completionRow(page, rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true })).toBeVisible()
  })

  test('a entrada de log de assumir pedido não tem ícone', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Log So Assumir ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')

    await openLogs(page)

    const rows = logRows(page, rescueRequest.requester_name)
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText('Em resgate')
    await expect(rows.getByRole('button')).toHaveCount(0)
  })

  test('a janela do ícone mostra completos os 1000 caracteres de uma observação no limite', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const note = `Observação no limite ${Date.now()} `.padEnd(1000, 'l')
    const { rescueRequest } = await finishRequest(request, 'Limite', { note })

    await openLogs(page)
    await completionRow(page, rescueRequest.requester_name).getByRole('button', { name: 'Ver observação', exact: true }).click()

    await expect(page.getByRole('dialog')).toContainText(note)
  })
})
