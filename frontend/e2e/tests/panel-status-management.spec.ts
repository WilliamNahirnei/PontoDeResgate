import { test, expect, injectSession } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { adminMasterToken, createOperator, loginViaApi } from '../fixtures/operators'
import { completeThroughDialog, confirmOtherOperatorWarning, holdStatusAction } from '../fixtures/status-actions'

function card(page, name: string) {
  return page.locator('.rescue-requests-list .v-card', { hasText: name })
}

// Cria um pedido em cada status, com nomes únicos desta execução.
async function createOneRequestPerStatus(request, label: string) {
  const unique = Date.now()
  const pending = await createRescueRequest(request, { requester_name: `E2E ${label} Pendente ${unique}` })
  const inRescue = await createRescueRequest(request, { requester_name: `E2E ${label} Em Resgate ${unique}` })
  const completed = await createRescueRequest(request, { requester_name: `E2E ${label} Concluido ${unique}` })
  const cancelled = await createRescueRequest(request, { requester_name: `E2E ${label} Cancelado ${unique}` })
  await changeRescueRequestStatus(request, inRescue.id, 'assume')
  await changeRescueRequestStatus(request, completed.id, 'assume')
  await changeRescueRequestStatus(request, completed.id, 'complete')
  await changeRescueRequestStatus(request, cancelled.id, 'cancel')

  return { pending, inRescue, completed, cancelled }
}

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

const NOT_PENDING_MESSAGE = /não está mais pendente e pode ter sido assumido por outro operador/i
const CHANGED_BY_ANOTHER_OPERATOR_MESSAGE = /alterado por outro operador/i
// Qualquer mensagem de erro que o painel mostra quando uma ação de status falha.
const STATUS_ACTION_ERROR_MESSAGE = /não está mais pendente|alterado por outro operador|não foi possível alterar o pedido/i

const SHARE_FAILED_MESSAGE = /não pôde ser copiada automaticamente/i

// Reproduz o HTTP puro, em que o navegador não oferece a área de transferência.
function removeClipboard() {
  Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true })
}

// Abre o painel do operador A num segundo contexto de navegador: a disputa só
// existe com duas sessões, cada uma com a própria tela carregada.
async function openPanelAsAnotherOperator(browser, request) {
  const operator = await createOperator(request)
  const context = await browser.newContext({ baseURL: BASE_URL })
  const operatorPage = await context.newPage()
  await injectSession(operatorPage, operator.token, operator.user)
  await operatorPage.goto('/painel')

  return { operator, context, operatorPage }
}

async function cancelThroughDialog(page, rescueCard, reason: string, options: { ofAnotherOperator?: boolean } = {}) {
  await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
  if (options.ofAnotherOperator) {
    await confirmOtherOperatorWarning(page)
  }
  await page.getByLabel('Motivo do cancelamento').fill(reason)
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
}

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

    await completeThroughDialog(page, card)

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

  test('compartilhar localização copia o link mesmo com o menu de compartilhamento do dispositivo disponível', async ({
    page,
    request,
    context,
    loginAsAdminMaster,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
    // Simula um dispositivo com menu de compartilhamento e registra as chamadas,
    // para provar que a ação não o usa.
    await page.addInitScript(() => {
      window.__sharedData = []
      Object.defineProperty(window.navigator, 'share', {
        value: (data) => {
          window.__sharedData.push(data)
          return Promise.resolve()
        },
        configurable: true,
      })
    })

    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Compartilhar Nativo ${Date.now()}` })

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Compartilhar localização' }).click()

    await expect(page.getByText('Localização copiada para a área de transferência.')).toBeVisible()
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain(String(rescueRequest.latitude))
    expect(clipboardText).toContain(String(rescueRequest.longitude))
    expect(await page.evaluate(() => window.__sharedData.length)).toBe(0)
  })

  test('sem acesso à área de transferência, compartilhar localização mostra um diálogo com o link para copiar manualmente', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await page.addInitScript(removeClipboard)

    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Compartilhar Sem Clipboard ${Date.now()}` })

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Compartilhar localização' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(SHARE_FAILED_MESSAGE)
    await expect(dialog).toContainText(`${rescueRequest.latitude},${rescueRequest.longitude}`)
    await expect(page.getByText('Localização copiada para a área de transferência.')).toHaveCount(0)
  })

  test('quando o navegador recusa a cópia, compartilhar localização mostra o diálogo com o link para copiar manualmente', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
        },
        configurable: true,
      })
    })

    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Compartilhar Recusado ${Date.now()}` })

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Compartilhar localização' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(SHARE_FAILED_MESSAGE)
    await expect(dialog).toContainText(`${rescueRequest.latitude},${rescueRequest.longitude}`)
    await expect(page.getByText('Localização copiada para a área de transferência.')).toHaveCount(0)
  })

  test('fechar o diálogo de cópia manual da localização não altera o pedido', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await page.addInitScript(removeClipboard)

    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Compartilhar Fechar ${Date.now()}` })

    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard.getByText('Pendente')).toBeVisible()
    await rescueCard.getByRole('button', { name: 'Compartilhar localização' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(SHARE_FAILED_MESSAGE)
    await dialog.getByRole('button', { name: 'Fechar' }).click()

    await expect(dialog).toBeHidden()
    await expect(rescueCard.getByText('Pendente')).toBeVisible()
    await expect(rescueCard.getByRole('button', { name: 'Assumir' })).toBeVisible()
    await expect(rescueCard.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  })

  test('o diálogo de cópia manual da localização não some sozinho', async ({ page, request, loginAsAdminMaster }) => {
    // O relógio controlado avança o tempo sem esperar de verdade: bem além dos
    // segundos em que a confirmação de cópia some sozinha.
    await page.clock.install()
    await page.addInitScript(removeClipboard)

    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Compartilhar Persistente ${Date.now()}` })

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Compartilhar localização' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(SHARE_FAILED_MESSAGE)

    await page.clock.fastForward(60_000)

    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(`${rescueRequest.latitude},${rescueRequest.longitude}`)
  })

  test('os botões de ação do card seguem o status do pedido', async ({ page, request, loginAsAdminMaster }) => {
    await loginAsAdminMaster()
    const { pending, inRescue, completed, cancelled } = await createOneRequestPerStatus(request, 'Botoes')

    await page.goto('/painel')

    const expectedButtons = [
      [pending, ['Assumir', 'Cancelar']],
      [inRescue, ['Concluir', 'Cancelar']],
      [completed, []],
      [cancelled, []],
    ] as const

    for (const [rescueRequest, visible] of expectedButtons) {
      const statusCard = card(page, rescueRequest.requester_name)
      await expect(statusCard.getByRole('button', { name: 'Compartilhar localização' })).toBeVisible()
      for (const action of ['Assumir', 'Concluir', 'Cancelar']) {
        const button = statusCard.getByRole('button', { name: action, exact: true })
        if ((visible as readonly string[]).includes(action)) {
          await expect(button, `${rescueRequest.requester_name}: ${action}`).toBeVisible()
        } else {
          await expect(button, `${rescueRequest.requester_name}: ${action}`).toHaveCount(0)
        }
      }
    }
  })

  test('depois de assumir, o card do pedido mostra o operador responsável', async ({
    page,
    request,
    loginAsNewOperator,
  }) => {
    const operator = await loginAsNewOperator()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Responsavel ${Date.now()}` })

    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard.getByText('Pendente')).toBeVisible()
    await expect(rescueCard).not.toContainText('Operador responsável')

    await rescueCard.getByRole('button', { name: 'Assumir' }).click()

    await expect(rescueCard.getByText('Em resgate')).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${operator.name}`)
  })

  test('operador cancela pela UI um pedido já em atendimento, informando o motivo', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Cancelar Em Resgate ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')

    await page.goto('/painel')

    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()

    const reason = `Motivo de teste E2E em resgate ${Date.now()}`
    await page.getByLabel('Motivo do cancelamento').fill(reason)
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(reason)
  })

  test('um operador diferente do que assumiu o pedido consegue concluí-lo pela UI', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const otherOperator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Concluir Outro ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', otherOperator.token)

    await page.goto('/painel')

    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard).toContainText(`Operador responsável: ${otherOperator.name}`)
    await completeThroughDialog(page, rescueCard, undefined, { ofAnotherOperator: true })

    await expect(rescueCard.getByText('Concluído')).toBeVisible()
  })

  test('um operador diferente do que assumiu o pedido consegue cancelá-lo pela UI', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const otherOperator = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Cancelar Outro ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', otherOperator.token)

    await page.goto('/painel')

    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard).toContainText(`Operador responsável: ${otherOperator.name}`)
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
    await confirmOtherOperatorWarning(page)

    const reason = `Cancelado por outro operador ${Date.now()}`
    await page.getByLabel('Motivo do cancelamento').fill(reason)
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(reason)
  })

  test('o campo do motivo do cancelamento mostra quantos caracteres já foram usados de 1000', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const name = `E2E Contador Motivo ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })

    await page.goto('/painel')
    await card(page, name).getByRole('button', { name: 'Cancelar' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/^\s*0\s*(\/|de)\s*1000\s*$/)).toBeVisible()

    await page.getByLabel('Motivo do cancelamento').pressSequentially('Chuva forte')
    await expect(dialog.getByText(/^\s*11\s*(\/|de)\s*1000\s*$/)).toBeVisible()
  })

  test('o campo do motivo do cancelamento não aceita mais de 1000 caracteres, digitados ou colados', async ({
    page,
    context,
    request,
    loginAsAdminMaster,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
    await loginAsAdminMaster()
    const name = `E2E Limite Motivo ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })
    const rescueCard = card(page, name)

    await page.goto('/painel')
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
    const reasonField = page.getByLabel('Motivo do cancelamento')

    // Digitado: com 999 caracteres no campo, só o próximo caractere digitado entra.
    const typedPrefix = 'd'.repeat(999)
    await reasonField.fill(typedPrefix)
    await reasonField.pressSequentially('XY')
    await expect(reasonField).toHaveValue(`${typedPrefix}X`)

    // Colado: um texto de 1001 caracteres colado pela área de transferência para no 1000º.
    const pastedReason = `Motivo colado ${Date.now()} `.padEnd(1000, 'c')
    await reasonField.fill('')
    await page.evaluate((text) => navigator.clipboard.writeText(text), `${pastedReason}Z`)
    await reasonField.press('ControlOrMeta+V')
    await expect(reasonField).toHaveValue(pastedReason)

    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(pastedReason)
    await expect(rescueCard).not.toContainText(`${pastedReason}Z`)
  })

  test('motivo do cancelamento com exatamente 1000 caracteres é aceito e aparece completo no card', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const name = `E2E Motivo 1000 ${Date.now()}`
    await createRescueRequest(request, { requester_name: name })
    const rescueCard = card(page, name)
    const reason = `Motivo com 1000 caracteres ${Date.now()} `.padEnd(1000, 'm')

    await page.goto('/painel')
    await cancelThroughDialog(page, rescueCard, reason)

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(reason)
  })

  test('o painel não oferece nenhuma ação para excluir um pedido, em nenhum status', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const requests = await createOneRequestPerStatus(request, 'Excluir')

    await page.goto('/painel')

    for (const rescueRequest of Object.values(requests)) {
      const rescueCard = card(page, rescueRequest.requester_name)
      await expect(rescueCard.getByRole('button', { name: 'Compartilhar localização' })).toBeVisible()
      await expect(rescueCard.getByRole('button', { name: /excluir|apagar|remover|deletar/i })).toHaveCount(0)
      await expect(rescueCard.getByRole('link', { name: /excluir|apagar|remover|deletar/i })).toHaveCount(0)
    }
  })

  test('ao clicar em "Concluir", o operador vê o campo da observação antes de o pedido ser concluído, e o pedido continua em resgate', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Dialogo ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Concluir pedido')).toBeVisible()
    await expect(dialog.getByLabel('Observação da conclusão')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirmar conclusão' })).toBeEnabled()
    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
  })

  test('operador conclui um pedido informando a observação e o card do pedido concluído mostra essa observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Informada ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)
    const note = `Família resgatada em segurança ${Date.now()}.`

    await page.goto('/painel')
    await completeThroughDialog(page, rescueCard, note)

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Observação da conclusão: ${note}`)
  })

  test('operador conclui um pedido sem preencher a observação: o pedido vira concluído e o card não mostra linha de observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Vazia ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await completeThroughDialog(page, rescueCard)

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).not.toContainText('Observação da conclusão')
  })

  test('observação só com espaços em branco é tratada como não informada: o pedido é concluído e o card não mostra linha de observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Espacos ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await completeThroughDialog(page, rescueCard, '    ')

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).not.toContainText('Observação da conclusão')
  })

  test('observação com exatamente 1000 caracteres é aceita e aparece completa no card', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs 1000 ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)
    const note = `Observação com 1000 caracteres ${Date.now()} `.padEnd(1000, 'o')

    await page.goto('/painel')
    await completeThroughDialog(page, rescueCard, note)

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(note)
  })

  test('o campo da observação não aceita mais de 1000 caracteres, digitados ou colados, e o pedido guarda 1000', async ({
    page,
    context,
    request,
    loginAsAdminMaster,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Limite ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()
    const noteField = page.getByLabel('Observação da conclusão')

    // Digitado: com 999 caracteres no campo, só o próximo caractere digitado entra.
    const typedPrefix = 'd'.repeat(999)
    await noteField.fill(typedPrefix)
    await noteField.pressSequentially('XY')
    await expect(noteField).toHaveValue(`${typedPrefix}X`)

    // Colado: um texto de 1001 caracteres para no 1000º.
    const pastedNote = `Observação colada ${Date.now()} `.padEnd(1000, 'c')
    await noteField.fill('')
    await page.evaluate((text) => navigator.clipboard.writeText(text), `${pastedNote}Z`)
    await noteField.press('ControlOrMeta+V')
    await expect(noteField).toHaveValue(pastedNote)

    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(pastedNote)
    await expect(rescueCard).not.toContainText(`${pastedNote}Z`)
  })

  test('operador desiste no diálogo da observação: o pedido continua em resgate, com "Concluir" e "Cancelar" disponíveis, e o card não mostra observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Desistir ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()
    await page.getByLabel('Observação da conclusão').fill('Texto que não deve ser registrado.')
    await page.getByRole('button', { name: 'Voltar' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await expect(rescueCard.getByRole('button', { name: 'Concluir' })).toBeVisible()
    await expect(rescueCard.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(rescueCard).not.toContainText('Observação da conclusão')
    await expect(rescueCard).not.toContainText('Texto que não deve ser registrado.')
  })

  test('o card de um pedido concluído, com ou sem observação, não oferece nenhuma ação para alterar ou incluir a observação', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const unique = Date.now()
    const withNote = await createRescueRequest(request, { requester_name: `E2E Obs Fixa Com ${unique}` })
    const withoutNote = await createRescueRequest(request, { requester_name: `E2E Obs Fixa Sem ${unique}` })
    for (const rescueRequest of [withNote, withoutNote]) {
      await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    }
    await changeRescueRequestStatus(request, withNote.id, 'complete', undefined, { completion_note: 'Observação definitiva.' })
    await changeRescueRequestStatus(request, withoutNote.id, 'complete')

    await page.goto('/painel')

    for (const rescueRequest of [withNote, withoutNote]) {
      const rescueCard = card(page, rescueRequest.requester_name)
      await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
      await expect(rescueCard.getByRole('button', { name: /^(Concluir|Cancelar|Assumir)$/ })).toHaveCount(0)
      await expect(rescueCard.getByRole('button', { name: /observa/i })).toHaveCount(0)
      await expect(rescueCard.getByRole('textbox')).toHaveCount(0)
    }
  })

  test('um operador diferente do que concluiu o pedido, e o admin master, veem a observação da conclusão no card', async ({
    page,
    request,
    loginAsNewOperator,
    browser,
  }) => {
    const unique = Date.now()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Outros ${unique}` })
    const completer = await createOperator(request)
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', completer.token)
    const note = `Observação visível a todos ${unique}.`
    await changeRescueRequestStatus(request, rescueRequest.id, 'complete', completer.token, { completion_note: note })

    // Outro operador comum.
    await loginAsNewOperator()
    await page.goto('/painel')
    await expect(card(page, rescueRequest.requester_name)).toContainText(`Observação da conclusão: ${note}`)

    // Admin master, em outro contexto de navegador.
    const admin = await loginViaApi(request, 'admin@pontoderesgate.local', 'password')
    const adminContext = await browser.newContext({ baseURL: BASE_URL })
    const adminPage = await adminContext.newPage()
    await injectSession(adminPage, admin.token, admin.user)
    await adminPage.goto('/painel')
    await expect(card(adminPage, rescueRequest.requester_name)).toContainText(`Observação da conclusão: ${note}`)
    await adminContext.close()
  })

  test('o diálogo de cancelamento pede somente o motivo (obrigatório), sem o campo de observação da conclusão', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Cancelar ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Cancelar' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Motivo do cancelamento')).toBeVisible()
    await expect(dialog.getByLabel('Observação da conclusão')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDisabled()
  })

  test('assumir um pedido pendente não oferece campo de observação: o pedido passa a em resgate direto, sem diálogo', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Assumir ${Date.now()}` })
    const rescueCard = card(page, rescueRequest.requester_name)

    await page.goto('/painel')
    await rescueCard.getByRole('button', { name: 'Assumir' }).click()

    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Observação da conclusão')).toHaveCount(0)
  })

  test('depois que um operador conclui com observação o pedido enviado pela tela pública, nenhuma tela pública mostra a observação', async ({
    page,
    request,
  }) => {
    const unique = Date.now()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Publica ${unique}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
    const note = `Observação sigilosa ${unique}.`
    await changeRescueRequestStatus(request, rescueRequest.id, 'complete', undefined, { completion_note: note })

    for (const publicPath of ['/', '/painel']) {
      await page.goto(publicPath)
      await expect(page.getByText(note)).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText('Observação da conclusão')
    }
  })

  test('o campo da observação da conclusão mostra quantos caracteres já foram usados de 1000', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Obs Contador ${Date.now()}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume')

    await page.goto('/painel')
    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Concluir' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/^\s*0\s*(\/|de)\s*1000\s*$/)).toBeVisible()

    await page.getByLabel('Observação da conclusão').pressSequentially('Tudo certo')
    await expect(dialog.getByText(/^\s*10\s*(\/|de)\s*1000\s*$/)).toBeVisible()
  })

  test.describe('ação em andamento (duplo clique)', () => {
    test('duplo clique em Assumir deixa o pedido em resgate, com o operador responsável, sem mensagem de erro', async ({
      page,
      request,
      loginAsNewOperator,
    }) => {
      const operator = await loginAsNewOperator()
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Duplo Assumir ${unique}` })
      const rescueCard = card(page, rescueRequest.requester_name)

      await page.goto('/painel')
      const assume = await holdStatusAction(page, rescueRequest.id, 'assume')
      await rescueCard.getByRole('button', { name: 'Assumir' }).dblclick()
      await assume.releaseAndWait()

      await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
      await expect(rescueCard).toContainText(`Operador responsável: ${operator.name}`)
      await expect(page.getByText(STATUS_ACTION_ERROR_MESSAGE)).toHaveCount(0)
    })

    test('duplo clique em Concluir deixa o pedido concluído, sem mensagem de erro', async ({
      page,
      request,
      loginAsAdminMaster,
    }) => {
      await loginAsAdminMaster()
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Duplo Concluir ${unique}` })
      await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
      const rescueCard = card(page, rescueRequest.requester_name)

      await page.goto('/painel')
      const complete = await holdStatusAction(page, rescueRequest.id, 'complete')
      await rescueCard.getByRole('button', { name: 'Concluir' }).click()
      await page.getByRole('button', { name: 'Confirmar conclusão' }).dblclick()
      await complete.releaseAndWait()

      await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
      await expect(page.getByText(STATUS_ACTION_ERROR_MESSAGE)).toHaveCount(0)
    })

    test('duplo clique em Confirmar cancelamento deixa o pedido cancelado e fecha o diálogo, sem mensagem de erro', async ({
      page,
      request,
      loginAsAdminMaster,
    }) => {
      await loginAsAdminMaster()
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Duplo Cancelar ${unique}` })
      const rescueCard = card(page, rescueRequest.requester_name)

      await page.goto('/painel')
      await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByLabel('Motivo do cancelamento').fill('Duplo clique ao confirmar.')
      const cancel = await holdStatusAction(page, rescueRequest.id, 'cancel')
      await page.getByRole('button', { name: 'Confirmar cancelamento' }).dblclick()
      await cancel.releaseAndWait()

      await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toHaveCount(0)
      await expect(page.getByText(STATUS_ACTION_ERROR_MESSAGE)).toHaveCount(0)
    })

    test('enquanto a ação está em andamento, o botão acionado fica indisponível e depois volta a refletir o status', async ({
      page,
      request,
      loginAsAdminMaster,
    }) => {
      await loginAsAdminMaster()
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const toFinish = await createRescueRequest(request, { requester_name: `E2E Em Andamento Concluir ${unique}` })
      const toCancel = await createRescueRequest(request, { requester_name: `E2E Em Andamento Cancelar ${unique}` })
      const toFinishCard = card(page, toFinish.requester_name)
      const toCancelCard = card(page, toCancel.requester_name)
      await page.goto('/painel')

      const assume = await holdStatusAction(page, toFinish.id, 'assume')
      await toFinishCard.getByRole('button', { name: 'Assumir' }).click()
      await expect(toFinishCard.getByRole('button', { name: 'Assumir' })).toBeDisabled()
      await assume.releaseAndWait()
      await expect(toFinishCard.getByText('Em resgate', { exact: true })).toBeVisible()
      await expect(toFinishCard.getByRole('button', { name: 'Concluir' })).toBeEnabled()

      const complete = await holdStatusAction(page, toFinish.id, 'complete')
      await toFinishCard.getByRole('button', { name: 'Concluir' }).click()
      await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
      await expect(page.getByRole('button', { name: 'Confirmar conclusão' })).toBeDisabled()
      await complete.releaseAndWait()
      await expect(toFinishCard.getByText('Concluído', { exact: true })).toBeVisible()
      await expect(toFinishCard.getByRole('button', { name: 'Concluir' })).toHaveCount(0)

      await toCancelCard.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByLabel('Motivo do cancelamento').fill('Botão indisponível durante a ação.')
      const cancel = await holdStatusAction(page, toCancel.id, 'cancel')
      await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
      await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDisabled()
      await cancel.releaseAndWait()
      await expect(toCancelCard.getByText('Cancelado', { exact: true })).toBeVisible()
    })

    test('enquanto a ação sobre um pedido está em andamento, os botões dos demais pedidos continuam disponíveis', async ({
      page,
      request,
      loginAsAdminMaster,
    }) => {
      await loginAsAdminMaster()
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const inProgress = await createRescueRequest(request, { requester_name: `E2E Trava Pedido ${unique}` })
      const other = await createRescueRequest(request, { requester_name: `E2E Trava Outro ${unique}` })
      const inProgressCard = card(page, inProgress.requester_name)
      const otherCard = card(page, other.requester_name)
      await page.goto('/painel')

      const assume = await holdStatusAction(page, inProgress.id, 'assume')
      await inProgressCard.getByRole('button', { name: 'Assumir' }).click()
      // Confirma que a ação está mesmo em andamento e travada; sem isso, os botões
      // do outro pedido estariam disponíveis só porque nada trava.
      await expect(inProgressCard.getByRole('button', { name: 'Assumir' })).toBeDisabled()

      await expect(otherCard.getByRole('button', { name: 'Assumir' })).toBeEnabled()
      await expect(otherCard.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
      await otherCard.getByRole('button', { name: 'Assumir' }).click()
      await expect(otherCard.getByText('Em resgate', { exact: true })).toBeVisible()

      await assume.releaseAndWait()
      await expect(inProgressCard.getByText('Em resgate', { exact: true })).toBeVisible()
    })
  })

  test.describe('disputa entre dois operadores com a página desatualizada', () => {
    test('quem clica em Assumir num pedido que outro operador acabou de assumir vê que ele não está mais pendente e o painel atualiza o pedido', async ({
      page,
      request,
      browser,
      loginAsNewOperator,
    }) => {
      await loginAsNewOperator()
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Disputa Assumir ${Date.now()}` })
      await page.goto('/painel')
      const rescueCard = card(page, rescueRequest.requester_name)
      await expect(rescueCard.getByText('Pendente', { exact: true })).toBeVisible()

      const { operator, context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      const operatorCard = card(operatorPage, rescueRequest.requester_name)
      await operatorCard.getByRole('button', { name: 'Assumir' }).click()
      await expect(operatorCard.getByText('Em resgate', { exact: true })).toBeVisible()

      await rescueCard.getByRole('button', { name: 'Assumir' }).click()

      await expect(page.getByText(NOT_PENDING_MESSAGE)).toBeVisible()
      await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
      await expect(rescueCard).toContainText(`Operador responsável: ${operator.name}`)
      await expect(rescueCard.getByRole('button', { name: 'Assumir' })).toHaveCount(0)

      await context.close()
    })

    test('a mensagem de quem perde a disputa ao assumir não mostra o nome do operador que assumiu o pedido', async ({
      page,
      request,
      browser,
      loginAsNewOperator,
    }) => {
      await loginAsNewOperator()
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Disputa Nome ${Date.now()}` })
      await page.goto('/painel')
      const rescueCard = card(page, rescueRequest.requester_name)
      await expect(rescueCard.getByText('Pendente', { exact: true })).toBeVisible()

      const { operator, context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      const operatorCard = card(operatorPage, rescueRequest.requester_name)
      await operatorCard.getByRole('button', { name: 'Assumir' }).click()
      await expect(operatorCard.getByText('Em resgate', { exact: true })).toBeVisible()

      await rescueCard.getByRole('button', { name: 'Assumir' }).click()

      const message = page.getByText(NOT_PENDING_MESSAGE)
      await expect(message).toBeVisible()
      await expect(message).not.toContainText(operator.name)

      await context.close()
    })

    test('quem clica em Assumir num pedido que outro operador cancelou vê a mesma mensagem e o painel mostra o pedido cancelado', async ({
      page,
      request,
      browser,
      loginAsNewOperator,
    }) => {
      await loginAsNewOperator()
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Disputa Assumir Anulado ${Date.now()}` })
      await page.goto('/painel')
      const rescueCard = card(page, rescueRequest.requester_name)
      await expect(rescueCard.getByText('Pendente', { exact: true })).toBeVisible()

      const { context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      const operatorCard = card(operatorPage, rescueRequest.requester_name)
      await cancelThroughDialog(operatorPage, operatorCard, 'Solicitante já foi resgatado por vizinhos.')
      await expect(operatorCard.getByText('Cancelado', { exact: true })).toBeVisible()

      await rescueCard.getByRole('button', { name: 'Assumir' }).click()

      await expect(page.getByText(NOT_PENDING_MESSAGE)).toBeVisible()
      await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
      await expect(rescueCard.getByRole('button', { name: 'Assumir' })).toHaveCount(0)

      await context.close()
    })

    test('concluir ou cancelar um pedido que outro operador alterou mostra que ele foi alterado por outro operador e o painel mostra o status atual', async ({
      page,
      request,
      browser,
      loginAsNewOperator,
    }) => {
      await loginAsNewOperator()
      const unique = Date.now()
      const toComplete = await createRescueRequest(request, { requester_name: `E2E Disputa Concluir ${unique}` })
      const toCancel = await createRescueRequest(request, { requester_name: `E2E Disputa Encerrar ${unique}` })
      await changeRescueRequestStatus(request, toComplete.id, 'assume')
      await changeRescueRequestStatus(request, toCancel.id, 'assume')
      await page.goto('/painel')
      const toCompleteCard = card(page, toComplete.requester_name)
      const toCancelCard = card(page, toCancel.requester_name)
      await expect(toCompleteCard.getByText('Em resgate', { exact: true })).toBeVisible()
      await expect(toCancelCard.getByText('Em resgate', { exact: true })).toBeVisible()

      const { context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      // A cancela o pedido que B vai tentar concluir.
      const operatorToCompleteCard = card(operatorPage, toComplete.requester_name)
      await cancelThroughDialog(operatorPage, operatorToCompleteCard, 'Equipe não conseguiu chegar ao local.', {
        ofAnotherOperator: true,
      })
      await expect(operatorToCompleteCard.getByText('Cancelado', { exact: true })).toBeVisible()

      await completeThroughDialog(page, toCompleteCard, undefined, { ofAnotherOperator: true })
      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
      await expect(toCompleteCard.getByText('Cancelado', { exact: true })).toBeVisible()

      // A recusa acima recarrega a lista de B; só agora A conclui o pedido que B
      // vai tentar cancelar, para o card de B estar de fato desatualizado.
      const operatorToCancelCard = card(operatorPage, toCancel.requester_name)
      await completeThroughDialog(operatorPage, operatorToCancelCard, undefined, { ofAnotherOperator: true })
      await expect(operatorToCancelCard.getByText('Concluído', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Fechar' }).click()
      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toHaveCount(0)

      await cancelThroughDialog(page, toCancelCard, 'Tentativa de cancelar pedido já concluído.', { ofAnotherOperator: true })
      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
      await expect(toCancelCard.getByText('Concluído', { exact: true })).toBeVisible()

      await context.close()
    })

    test('se o diálogo de cancelamento está aberto quando o pedido é alterado por outro operador, ele fecha junto com a mensagem de erro', async ({
      page,
      request,
      browser,
      loginAsNewOperator,
    }) => {
      await loginAsNewOperator()
      const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Disputa Dialogo ${Date.now()}` })
      await changeRescueRequestStatus(request, rescueRequest.id, 'assume')
      await page.goto('/painel')
      const rescueCard = card(page, rescueRequest.requester_name)
      await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
      await confirmOtherOperatorWarning(page)
      await page.getByLabel('Motivo do cancelamento').fill('Motivo digitado antes da mudança do outro operador.')

      const { context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      const operatorCard = card(operatorPage, rescueRequest.requester_name)
      await completeThroughDialog(operatorPage, operatorCard, undefined, { ofAnotherOperator: true })
      await expect(operatorCard.getByText('Concluído', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
      await expect(page.getByLabel('Motivo do cancelamento')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toHaveCount(0)

      await context.close()
    })
  })
})

test.describe('pedido de outro operador', () => {
  const OTHER_OPERATOR_TITLE = 'Pedido de outro operador'

  const warning = (page) => page.getByRole('dialog').filter({ hasText: OTHER_OPERATOR_TITLE })

  // O operador A assume o pedido por API e o operador B, de quem é a tela, o
  // abre no painel. B é um operador novo, sem nenhum outro pedido.
  async function openRequestOfAnotherOperator(page, request, label: string) {
    const assigned = await createOperator(request)
    const acting = await createOperator(request)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Alheio ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await changeRescueRequestStatus(request, rescueRequest.id, 'assume', assigned.token)
    await injectSession(page, acting.token, acting.user)
    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard).toContainText(`Operador responsável: ${assigned.name}`)

    return { assigned, acting, rescueRequest, rescueCard }
  }

  test('ao acionar Concluir num pedido Em resgate de outro operador, a tela avisa que o pedido é de outro operador, mostra o nome do responsável e pede confirmação antes do diálogo de observação', async ({
    page,
    request,
  }) => {
    const { assigned, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Concluir')

    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

    await expect(warning(page)).toBeVisible()
    await expect(warning(page)).toContainText(assigned.name)
    await expect(page.getByLabel('Observação da conclusão')).toHaveCount(0)
  })

  test('confirmar o aviso de pedido de outro operador abre o diálogo de observação, e concluir deixa o pedido Concluído', async ({
    page,
    request,
  }) => {
    const { rescueCard } = await openRequestOfAnotherOperator(page, request, 'Concluir Confirma')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

    await warning(page).getByRole('button', { name: 'Continuar' }).click()

    await expect(warning(page)).toHaveCount(0)
    await expect(page.getByLabel('Observação da conclusão')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
  })

  test('desistir do aviso ao concluir pedido de outro operador não altera o pedido: continua Em resgate, com o responsável original', async ({
    page,
    request,
  }) => {
    const { assigned, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Concluir Desiste')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

    await warning(page).getByRole('button', { name: 'Voltar' }).click()

    await expect(warning(page)).toHaveCount(0)
    await expect(page.getByLabel('Observação da conclusão')).toHaveCount(0)
    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${assigned.name}`)
    await expect(rescueCard.getByRole('button', { name: 'Concluir' })).toBeVisible()
  })

  test('ao acionar Cancelar num pedido Em resgate de outro operador, a tela avisa que o pedido é de outro operador, mostra o nome do responsável e pede confirmação antes do diálogo do motivo', async ({
    page,
    request,
  }) => {
    const { assigned, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Cancelar')

    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()

    await expect(warning(page)).toBeVisible()
    await expect(warning(page)).toContainText(assigned.name)
    await expect(page.getByLabel('Motivo do cancelamento')).toHaveCount(0)
  })

  test('confirmar o aviso de pedido de outro operador abre o diálogo do motivo, e cancelar deixa o pedido Cancelado', async ({
    page,
    request,
  }) => {
    const { rescueCard } = await openRequestOfAnotherOperator(page, request, 'Cancelar Confirma')
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()

    await warning(page).getByRole('button', { name: 'Continuar' }).click()

    await expect(warning(page)).toHaveCount(0)
    await page.getByLabel('Motivo do cancelamento').fill('Equipe sem acesso ao local.')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
  })

  test('desistir do aviso ao cancelar pedido de outro operador não altera o pedido: continua Em resgate, com o responsável original', async ({
    page,
    request,
  }) => {
    const { assigned, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Cancelar Desiste')
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()

    await warning(page).getByRole('button', { name: 'Voltar' }).click()

    await expect(warning(page)).toHaveCount(0)
    await expect(page.getByLabel('Motivo do cancelamento')).toHaveCount(0)
    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${assigned.name}`)
  })

  test('concluir ou cancelar um pedido do próprio operador não mostra o aviso: abre direto o diálogo de observação ou do motivo', async ({
    page,
    request,
  }) => {
    const operator = await createOperator(request)
    await injectSession(page, operator.token, operator.user)
    const toComplete = await createRescueRequest(request, { requester_name: `E2E Proprio Concluir ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    const toCancel = await createRescueRequest(request, { requester_name: `E2E Proprio Cancelar ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await changeRescueRequestStatus(request, toComplete.id, 'assume', operator.token)
    await changeRescueRequestStatus(request, toCancel.id, 'assume', operator.token)
    await page.goto('/painel')
    await expect(card(page, toComplete.requester_name)).toContainText(`Operador responsável: ${operator.name}`)

    await card(page, toComplete.requester_name).getByRole('button', { name: 'Concluir' }).click()
    await expect(page.getByLabel('Observação da conclusão')).toBeVisible()
    await expect(warning(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Voltar' }).click()

    await card(page, toCancel.requester_name).getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByLabel('Motivo do cancelamento')).toBeVisible()
    await expect(warning(page)).toHaveCount(0)
  })

  test('cancelar um pedido Pendente, que não tem responsável, não mostra o aviso: abre direto o diálogo do motivo', async ({
    page,
    request,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Alheio Pendente ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await page.goto('/painel')

    await card(page, rescueRequest.requester_name).getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByLabel('Motivo do cancelamento')).toBeVisible()
    await expect(warning(page)).toHaveCount(0)
  })

  test('assumir um pedido Pendente não mostra o aviso de pedido de outro operador', async ({
    page,
    request,
    loginAsNewOperator,
  }) => {
    await loginAsNewOperator()
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Alheio Assumir ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)

    await rescueCard.getByRole('button', { name: 'Assumir' }).click()

    await expect(rescueCard.getByText('Em resgate', { exact: true })).toBeVisible()
    await expect(warning(page)).toHaveCount(0)
  })

  test('depois que o operador B conclui o pedido que o operador A assumiu, o card do pedido passa a mostrar B como responsável', async ({
    page,
    request,
  }) => {
    const { assigned, acting, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Troca Concluir')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()
    await warning(page).getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()

    await expect(rescueCard.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${acting.name}`)
    await expect(rescueCard).not.toContainText(assigned.name)
  })

  test('depois que o operador B cancela o pedido Em resgate que o operador A assumiu, o card do pedido passa a mostrar B como responsável', async ({
    page,
    request,
  }) => {
    const { assigned, acting, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Troca Cancelar')
    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
    await warning(page).getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('Equipe sem acesso ao local.')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${acting.name}`)
    await expect(rescueCard).not.toContainText(assigned.name)
  })

  test('depois que um operador cancela um pedido Pendente, o card do pedido passa a mostrar esse operador como responsável', async ({
    page,
    request,
  }) => {
    const operator = await createOperator(request)
    await injectSession(page, operator.token, operator.user)
    const rescueRequest = await createRescueRequest(request, { requester_name: `E2E Troca Pendente ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await page.goto('/painel')
    const rescueCard = card(page, rescueRequest.requester_name)
    await expect(rescueCard.getByText('Pendente', { exact: true })).toBeVisible()
    await expect(rescueCard).not.toContainText('Operador responsável')

    await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('Pedido duplicado.')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(rescueCard).toContainText(`Operador responsável: ${operator.name}`)
  })

  test('o aviso de pedido de outro operador também aparece para o admin master que conclui ou cancela um pedido de operador', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
    await loginAsAdminMaster()
    const assigned = await createOperator(request)
    const toComplete = await createRescueRequest(request, { requester_name: `E2E Admin Concluir ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    const toCancel = await createRescueRequest(request, { requester_name: `E2E Admin Cancelar ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    await changeRescueRequestStatus(request, toComplete.id, 'assume', assigned.token)
    await changeRescueRequestStatus(request, toCancel.id, 'assume', assigned.token)
    await page.goto('/painel')

    await card(page, toComplete.requester_name).getByRole('button', { name: 'Concluir' }).click()
    await expect(warning(page)).toContainText(assigned.name)
    await warning(page).getByRole('button', { name: 'Voltar' }).click()

    await card(page, toCancel.requester_name).getByRole('button', { name: 'Cancelar' }).click()
    await expect(warning(page)).toContainText(assigned.name)
  })

  test('com o aviso de pedido de outro operador aberto, se o pedido muda de status por outra sessão, concluir mostra a mensagem de pedido alterado por outro operador e o painel atualiza o pedido', async ({
    page,
    request,
  }) => {
    const { assigned, rescueRequest, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Conflito')
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()
    await expect(warning(page)).toBeVisible()

    await changeRescueRequestStatus(request, rescueRequest.id, 'cancel', assigned.token)

    await warning(page).getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()

    await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
    await expect(rescueCard.getByText('Cancelado', { exact: true })).toBeVisible()
  })

  test('se o operador responsável foi desativado, o aviso de pedido de outro operador ainda mostra o nome dele', async ({
    page,
    request,
  }) => {
    const { assigned, rescueCard } = await openRequestOfAnotherOperator(page, request, 'Desativado')
    const deactivated = await request.post(`${API_BASE_URL}/api/operators/${assigned.id}/deactivate`, {
      headers: { Authorization: `Bearer ${await adminMasterToken(request)}` },
    })
    expect(deactivated.ok()).toBeTruthy()
    await page.getByRole('button', { name: 'Atualizar' }).click()
    await expect(rescueCard).toContainText(`Operador responsável: ${assigned.name}`)

    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

    await expect(warning(page)).toContainText(assigned.name)
  })
})
