import { test, expect, injectSession } from '../fixtures/auth'
import { changeRescueRequestStatus, createRescueRequest } from '../fixtures/rescue-requests'
import { createOperator } from '../fixtures/operators'
import { holdStatusAction } from '../fixtures/status-actions'

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

async function cancelThroughDialog(page, rescueCard, reason: string) {
  await rescueCard.getByRole('button', { name: 'Cancelar' }).click()
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

  test('compartilhar localização usa o compartilhamento nativo do dispositivo quando ele está disponível', async ({
    page,
    request,
    loginAsAdminMaster,
  }) => {
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

    await expect.poll(() => page.evaluate(() => window.__sharedData.length)).toBe(1)
    const shared = await page.evaluate(() => window.__sharedData[0])
    expect(shared.url).toContain(String(rescueRequest.latitude))
    expect(shared.url).toContain(String(rescueRequest.longitude))
    await expect(page.getByText('Localização copiada para a área de transferência.')).toHaveCount(0)
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
    await rescueCard.getByRole('button', { name: 'Concluir' }).click()

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
      await rescueCard.getByRole('button', { name: 'Concluir' }).dblclick()
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
      await expect(toFinishCard.getByRole('button', { name: 'Concluir' })).toBeDisabled()
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
      await cancelThroughDialog(operatorPage, operatorToCompleteCard, 'Equipe não conseguiu chegar ao local.')
      await expect(operatorToCompleteCard.getByText('Cancelado', { exact: true })).toBeVisible()

      await toCompleteCard.getByRole('button', { name: 'Concluir' }).click()
      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
      await expect(toCompleteCard.getByText('Cancelado', { exact: true })).toBeVisible()

      // A recusa acima recarrega a lista de B; só agora A conclui o pedido que B
      // vai tentar cancelar, para o card de B estar de fato desatualizado.
      const operatorToCancelCard = card(operatorPage, toCancel.requester_name)
      await operatorToCancelCard.getByRole('button', { name: 'Concluir' }).click()
      await expect(operatorToCancelCard.getByText('Concluído', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Fechar' }).click()
      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toHaveCount(0)

      await cancelThroughDialog(page, toCancelCard, 'Tentativa de cancelar pedido já concluído.')
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
      await page.getByLabel('Motivo do cancelamento').fill('Motivo digitado antes da mudança do outro operador.')

      const { context, operatorPage } = await openPanelAsAnotherOperator(browser, request)
      const operatorCard = card(operatorPage, rescueRequest.requester_name)
      await operatorCard.getByRole('button', { name: 'Concluir' }).click()
      await expect(operatorCard.getByText('Concluído', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()

      await expect(page.getByText(CHANGED_BY_ANOTHER_OPERATOR_MESSAGE)).toBeVisible()
      await expect(page.getByLabel('Motivo do cancelamento')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toHaveCount(0)

      await context.close()
    })
  })
})
