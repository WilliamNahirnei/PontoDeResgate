const L = require('/work/lib.cjs')
const fs = require('fs')
const { BASE, rec, api, TAG } = L

async function step(id, fn) {
  try { await fn() } catch (e) { rec(id, 'ERRO-DO-SCRIPT', String(e.message).split('\n')[0].slice(0, 260)) }
}
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
const stamp = Date.now()
const ids = {}

;(async () => {
  const b = await L.launch()
  const adm = await L.adminLogin()
  const admSession = { token: adm.token, user: adm.user }
  const opA = await L.mkOperator(adm.token, `D-opA-${stamp}`)
  const opB = await L.mkOperator(adm.token, `D-opB-${stamp}`)
  ids.opA = opA.id; ids.opB = opB.id
  const tokA = (await L.login(opA.email, opA.password)).token
  const tokB = (await L.login(opB.email, opB.password)).token

  const mk = async (label, fields = {}) => {
    const r = await L.mkRequest(adm.token, { requester_name: `${TAG} D-${label} ${stamp}`, latitude: -12.97 + Math.random() / 50, longitude: -38.5 + Math.random() / 50, total_people: 2, ...fields })
    ids[label] = r.id
    return r
  }
  const openAs = async (op, opts = {}) => {
    const c = await L.newCtx(b, opts)
    await L.uiLogin(c.page, op.email, op.password)
    await c.page.waitForURL(/\/painel$/, { timeout: 8000 })
    await c.page.locator('.rescue-requests-list .v-card').first().waitFor({ timeout: 10000 })
    await L.sleep(600)
    return c
  }
  const cardOf = (page, r) => page.locator('.rescue-requests-list .v-card', { hasText: r.name })
  const btns = async (card) => (await card.locator('button').allInnerTexts()).map((t) => flat(t).replace(/^\W+/, '')).filter(Boolean)

  // ---------- RES-116: botões por status ----------
  await step('RES-116', async () => {
    const pend = await mk('pendente')
    const emr = await mk('emresgate'); await api(`/api/rescue-requests/${emr.id}/assume`, { method: 'POST', token: tokA })
    const conc = await mk('concluido'); await api(`/api/rescue-requests/${conc.id}/assume`, { method: 'POST', token: tokA }); await api(`/api/rescue-requests/${conc.id}/complete`, { method: 'POST', token: tokA })
    const canc = await mk('cancelado'); await api(`/api/rescue-requests/${canc.id}/cancel`, { method: 'POST', token: tokA, body: { cancellation_reason: 'EXPLORATORIO matriz' } })
    const { context, page } = await openAs(opA)
    const exp = { pendente: ['ASSUMIR', 'CANCELAR', 'COMPARTILHAR LOCALIZAÇÃO'], emresgate: ['CONCLUIR', 'CANCELAR', 'COMPARTILHAR LOCALIZAÇÃO'], concluido: ['COMPARTILHAR LOCALIZAÇÃO'], cancelado: ['COMPARTILHAR LOCALIZAÇÃO'] }
    const map = { pendente: pend, emresgate: emr, concluido: conc, cancelado: canc }
    for (const [k, r] of Object.entries(map)) {
      const got = (await btns(cardOf(page, r))).map((t) => t.toUpperCase())
      rec(`RES-116/${k}`, JSON.stringify(got) === JSON.stringify(exp[k]) ? 'OK' : 'DIVERGE', `botões=${JSON.stringify(got)}`)
    }
    // RES-117: card do em_resgate mostra o operador; do cancelado mostra o motivo
    const t = flat(await cardOf(page, emr).innerText())
    rec('RES-117/api', t.includes(`Operador responsável: ${opA.name}`) ? 'OK' : 'DIVERGE', `card em resgate: "${t}"`)
    await context.close()
  })

  // ---------- RES-117 (pela UI) + RES-126: assumir e cancelar em atendimento ----------
  await step('RES-126', async () => {
    const r = await mk('ui-assumir-cancelar')
    const { context, page } = await openAs(opA)
    const card = cardOf(page, r)
    await card.getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1500)
    const t1 = flat(await card.innerText())
    rec('RES-117/ui', t1.includes(`Operador responsável: ${opA.name}`) && /Em resgate/.test(t1) ? 'OK' : 'DIVERGE', `após Assumir pela UI: "${t1}"`)
    await card.getByRole('button', { name: 'Cancelar' }).click()
    const confirm = page.getByRole('button', { name: 'Confirmar cancelamento' })
    await page.getByLabel('Motivo do cancelamento').fill('   ')
    const disabledSpaces = await confirm.isDisabled()
    await page.getByLabel('Motivo do cancelamento').fill('EXPLORATORIO: família já foi retirada por vizinhos')
    await confirm.click(); await L.sleep(1500)
    const t2 = flat(await card.innerText())
    rec('RES-126', /Cancelado/.test(t2) && t2.includes('família já foi retirada') && disabledSpaces ? 'OK' : 'DIVERGE', `motivo só com espaços mantém botão desabilitado=${disabledSpaces}; card após cancelar em atendimento: "${t2}"`)
    await context.close()
  })

  // ---------- cancelar com motivo > 1000 caracteres (dialog sem tratamento de erro) ----------
  await step('D-motivo-longo', async () => {
    const r = await mk('motivo-longo')
    const { context, page } = await openAs(opA)
    await cardOf(page, r).getByRole('button', { name: 'Cancelar' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('M'.repeat(1001))
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click(); await L.sleep(1500)
    const dialogOpen = await page.getByRole('button', { name: 'Confirmar cancelamento' }).count()
    const alerts = flat(await page.locator('.v-alert, .v-snackbar').allInnerTexts().then((a) => a.join(' | ')))
    const status = flat(await cardOf(page, r).innerText()).match(/Pendente|Cancelado/)?.[0]
    rec('D-motivo-longo', 'OBS', `motivo com 1001 caracteres: http=[${page.http.join(', ')}] diálogo-continua-aberto=${dialogOpen > 0} mensagem-na-tela="${alerts}" status-do-card=${status} erros-console=[${page.errors.join(' | ').slice(0, 160)}]`)
    await L.shot(page, 'd-motivo-longo')
    await context.close()
  })

  // ---------- RES-127 / RES-128 / CRZ-10: outro operador conclui e cancela ----------
  const rConcl = await mk('outro-concluir')
  const rCanc = await mk('outro-cancelar')
  await step('RES-127', async () => {
    // A assume os dois pela UI; B (sessão própria) conclui um e cancela o outro
    const a = await openAs(opA)
    await cardOf(a.page, rConcl).getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1200)
    await cardOf(a.page, rCanc).getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1200)
    await a.context.close()
    const bctx = await openAs(opB)
    const cc = cardOf(bctx.page, rConcl)
    const before = flat(await cc.innerText())
    await cc.getByRole('button', { name: 'Concluir' }).click(); await L.sleep(1500)
    const after = flat(await cc.innerText())
    rec('RES-127', /Concluído/.test(after) && after.includes(`Operador responsável: ${opA.name}`) ? 'OK' : 'DIVERGE', `B conclui pedido assumido por A -> card: "${after}"`)
    const cx = cardOf(bctx.page, rCanc)
    await cx.getByRole('button', { name: 'Cancelar' }).click()
    await bctx.page.getByLabel('Motivo do cancelamento').fill('EXPLORATORIO: cancelado por outro operador')
    await bctx.page.getByRole('button', { name: 'Confirmar cancelamento' }).click(); await L.sleep(1500)
    const after2 = flat(await cx.innerText())
    rec('RES-128', /Cancelado/.test(after2) ? 'OK' : 'DIVERGE', `B cancela pedido assumido por A -> card: "${after2}"`)
    await bctx.context.close()
  })

  // ---------- RES-129 / RES-118: página desatualizada ----------
  await step('RES-129', async () => {
    const r = await mk('stale-assumir')
    const A = await openAs(opA), B = await openAs(opB)
    const cardB = cardOf(B.page, r)
    const seenByB = flat(await cardB.innerText())
    await cardOf(A.page, r).getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1500)
    await cardB.getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1800)
    const feedback = flat((await B.page.locator('.v-alert, .v-snackbar, [role=alert]').allInnerTexts()).join(' | '))
    const stillStale = flat(await cardB.innerText())
    rec('RES-118/assumir-conflito', 'OBS', `B (página desatualizada) clicou Assumir: http=[${B.page.http.join(', ')}] mensagem-na-tela="${feedback}" card-de-B-depois="${stillStale}" erros-console=[${B.page.errors.join(' | ').slice(0, 140)}]`)
    await L.shot(B.page, 'res118-assumir-conflito')
    await B.page.getByRole('button', { name: 'Atualizar' }).click(); await L.sleep(1500)
    const refreshed = flat(await cardB.innerText())
    const final = (await api('/api/rescue-requests', { token: adm.token })).json.data.find((x) => x.id === r.id)
    rec('RES-129', final.operator?.id === opA.id && refreshed.includes(`Operador responsável: ${opA.name}`) ? 'OK' : 'DIVERGE', `após Atualizar B vê: "${refreshed}" | API: operador=${final.operator?.name} status=${final.status}`)

    // conflito ao concluir: A cancela, B (vendo "Concluir") tenta concluir
    const r2 = await mk('stale-concluir')
    await api(`/api/rescue-requests/${r2.id}/assume`, { method: 'POST', token: tokA })
    const B2 = await openAs(opB)
    const card2 = cardOf(B2.page, r2)
    await api(`/api/rescue-requests/${r2.id}/cancel`, { method: 'POST', token: tokA, body: { cancellation_reason: 'EXPLORATORIO stale' } })
    await card2.getByRole('button', { name: 'Concluir' }).click(); await L.sleep(1800)
    const fb2 = flat((await B2.page.locator('.v-alert, .v-snackbar, [role=alert]').allInnerTexts()).join(' | '))
    rec('RES-118/concluir-conflito', 'OBS', `B clicou Concluir num pedido já cancelado por A: http=[${B2.page.http.join(', ')}] mensagem-na-tela="${fb2}" card="${flat(await card2.innerText()).slice(0, 90)}"`)
    for (const c of [A, B, B2]) await c.context.close()
  })

  // ---------- duplo clique em Assumir ----------
  await step('D-duplo-clique', async () => {
    const r = await mk('duplo-assumir')
    const A = await openAs(opA)
    const card = cardOf(A.page, r)
    const btn = card.getByRole('button', { name: 'Assumir' })
    await btn.dblclick(); await L.sleep(2000)
    const logs = (await api('/api/rescue-status-logs?per_page=100', { token: adm.token })).json.data.filter((x) => x.rescue_request.id === r.id)
    rec('D-duplo-clique', 'OBS', `duplo clique em Assumir: http=[${A.page.http.join(', ')}] logs-gerados=${logs.length} erros-console=[${A.page.errors.join(' | ').slice(0, 140)}]`)
    await A.context.close()
  })

  // ---------- disputa simultânea real (API, dois operadores ao mesmo tempo) ----------
  await step('RES-96', async () => {
    let both = 0; const rounds = 8; const detail = []
    for (let i = 0; i < rounds; i++) {
      const r = await mk(`corrida-${i}`)
      const [ra, rb] = await Promise.all([
        api(`/api/rescue-requests/${r.id}/assume`, { method: 'POST', token: tokA }),
        api(`/api/rescue-requests/${r.id}/assume`, { method: 'POST', token: tokB }),
      ])
      const logs = (await api('/api/rescue-status-logs?per_page=100', { token: adm.token })).json.data.filter((x) => x.rescue_request.id === r.id)
      if (ra.status === 200 && rb.status === 200) both++
      detail.push(`${ra.status}/${rb.status}(logs=${logs.length})`)
    }
    rec('RES-96', both > 0 ? 'DIVERGE' : 'OK', `${rounds} rodadas de dois operadores assumindo o MESMO pedido ao mesmo tempo: ambos receberam 200 em ${both} rodada(s). Detalhe A/B: ${detail.join(' ')}`)
  })

  // ---------- CRZ-10 / RES-120: tela de logs ----------
  await step('CRZ-10', async () => {
    const { context, page } = await L.newCtx(b, {}, admSession)
    await page.goto(BASE + '/painel/logs')
    await page.locator('tbody tr').first().waitFor({ timeout: 10000 })
    await L.sleep(800)
    // as mudanças de rConcl (assumir por A, concluir por B) e rCanc (assumir por A, cancelar por B)
    const rowsOf = async (r) => (await page.locator('tbody tr', { hasText: r.name }).allInnerTexts()).map(flat)
    // pode estar em outra página: filtra pela API para achar a página certa
    let found = await rowsOf(rConcl)
    let guard = 0
    while (found.length < 2 && guard++ < 6) {
      const next = page.getByRole('button', { name: 'Next page' })
      if (!(await next.isEnabled())) break
      await next.click(); await L.sleep(1200)
      found = found.concat(await rowsOf(rConcl))
    }
    const hasDate = found.some((t) => /\d{2}\/\d{2}\/\d{4}/.test(t))
    const opsOk = found.some((t) => t.includes(opA.name) && /Pendente.*Em resgate/.test(t)) && found.some((t) => t.includes(opB.name) && /Em resgate.*Concluído/.test(t))
    rec('CRZ-10/concluir', opsOk ? 'OK' : 'DIVERGE', `linhas do pedido "outro-concluir": ${JSON.stringify(found)}`)
    rec('RES-120', hasDate && opsOk ? 'OK' : 'DIVERGE', `colunas exibem operador e data/hora: data=${hasDate}`)
    await L.shot(page, 'crz10-logs')
    const hdr = flat(await page.locator('thead').innerText())
    rec('RES-120/colunas', 'OBS', `cabeçalho da tela de logs: "${hdr}"`)
    await context.close()
  })

  // ---------- CRZ-11: desativar operador que já atendeu preserva o histórico ----------
  await step('CRZ-11', async () => {
    const r = await mk('hist-desativar')
    await api(`/api/rescue-requests/${r.id}/assume`, { method: 'POST', token: tokA })
    const d = await api(`/api/operators/${opA.id}/deactivate`, { method: 'POST', token: adm.token })
    const { context, page } = await L.newCtx(b, {}, admSession)
    await page.goto(BASE + '/painel'); await page.locator('.rescue-requests-list .v-card').first().waitFor(); await L.sleep(1000)
    const t = flat(await cardOf(page, r).innerText())
    await page.goto(BASE + '/painel/logs'); await page.locator('tbody tr').first().waitFor(); await L.sleep(1000)
    const rows = (await page.locator('tbody tr', { hasText: r.name }).allInnerTexts()).map(flat)
    rec('CRZ-11', d.status === 200 && t.includes(opA.name) && rows.some((x) => x.includes(opA.name)) ? 'OK' : 'DIVERGE', `opA desativado (API ${d.status}); card: "${t}"; logs: ${JSON.stringify(rows)}`)
    await context.close()
  })

  // ---------- mobile: cards e botões ----------
  await step('D-mobile', async () => {
    const { context, page } = await L.newCtx(b, { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }, admSession)
    await page.goto(BASE + '/painel'); await page.locator('.rescue-requests-list .v-card').first().waitFor(); await L.sleep(1000)
    const c = page.locator('.rescue-requests-list .v-card').first()
    const box = await c.boundingBox()
    const btnBoxes = await c.locator('button').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    rec('D-mobile', 'OBS', `375x667: card ${Math.round(box.width)}px; botões (LxA)=${btnBoxes.join(',')} (alvo de toque recomendado >= 44px); rolagem-horizontal=${overflow}`)
    await L.shot(page, 'd-mobile-cards')
    await context.close()
  })

  fs.writeFileSync('/work/charter-d-ids.json', JSON.stringify(ids))
  await b.close()
  console.log('FIM charter D')
})().catch((e) => { console.error('ERRO GERAL', e); process.exit(1) })
