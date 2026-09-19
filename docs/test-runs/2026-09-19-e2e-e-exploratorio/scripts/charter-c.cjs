const L = require('/work/lib.cjs')
const { BASE, rec, api, TAG } = L

async function step(id, fn) {
  try { await fn() } catch (e) { rec(id, 'ERRO-DO-SCRIPT', String(e.message).split('\n')[0].slice(0, 240)) }
}
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
const alertText = (page) => page.locator('.v-alert').first().innerText().catch(() => '')

;(async () => {
  const b = await L.launch()
  const adm = await L.adminLogin()
  const session = { token: adm.token, user: adm.user }
  const stamp = Date.now()

  // ---------- massa de dados própria (criada em ordem, com pausa para o created_at diferir) ----------
  const spec = [
    ['C1', { total_people: 10, men_count: 5, women_count: 3, children_count: 2, elderly_count: 0, animals_count: 0 }],
    ['C2', { total_people: 4, men_count: 1, women_count: 1, children_count: 1, elderly_count: 1, animals_count: 3 }],
    ['C3', {}], // sem nenhuma quantidade informada
    ['C4', { total_people: 20, men_count: 8, women_count: 8, children_count: 3, elderly_count: 1, animals_count: 5 }],
    ['C5', { total_people: 0, men_count: 0, women_count: 0, children_count: 0, elderly_count: 0, animals_count: 0 }],
    ['C6', {}],
  ]
  const mine = {}
  for (const [k, f] of spec) {
    mine[k] = await L.mkRequest(adm.token, { ...f, requester_name: `${TAG} ${k} ${stamp}` })
    await L.sleep(1100)
  }
  const far = await L.mkRequest(adm.token, { requester_name: `${TAG} Clisboa ${stamp}`, latitude: 38.7223, longitude: -9.1393, total_people: 3 })
  const names = Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, v.name]))
  console.log('massa criada:', JSON.stringify(Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, v.id]))), 'lisboa=', far.id)
  const key = (n) => Object.keys(names).find((k) => names[k] === n)

  const openPanel = async (opts = {}, ses = session) => {
    const c = await L.newCtx(b, opts, ses)
    await c.page.goto(BASE + '/painel')
    await c.page.locator('.rescue-requests-list .v-card').first().waitFor({ timeout: 10000 })
    await L.sleep(800)
    return c
  }
  const listText = (page) => page.locator('.rescue-requests-list').innerText()
  const visibleMine = async (page) => {
    const t = await listText(page)
    return Object.keys(names).filter((k) => t.includes(names[k]))
  }
  const orderMine = async (page) => {
    const t = await listText(page)
    return Object.keys(names).filter((k) => t.includes(names[k])).sort((a, c) => t.indexOf(names[a]) - t.indexOf(names[c]))
  }
  const pickSelect = async (page, label, option, exact = false) => {
    const cb = page.getByRole('combobox', { name: label })
    await cb.focus(); await cb.press('Enter')
    await page.getByRole('option', { name: option, exact }).click()
    await L.sleep(1200)
  }
  const openQty = async (page) => { await page.getByRole('button', { name: 'Filtrar por quantidade' }).click(); await L.sleep(300) }
  const setMin = async (page, label, value) => { await page.getByLabel(label).fill(String(value)); await L.sleep(1300) }
  const setsEqual = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

  // ---------- RES-122: filtro mínimo em cada categoria; RES-123: quem não informou some ----------
  await step('RES-122', async () => {
    const { context, page } = await openPanel()
    await openQty(page)
    const cases = [
      ['Mín. total de pessoas', 10, ['C1', 'C4']],
      ['Mín. homens', 5, ['C1', 'C4']],
      ['Mín. mulheres', 3, ['C1', 'C4']],
      ['Mín. crianças', 2, ['C1', 'C4']],
      ['Mín. idosos', 1, ['C2', 'C4']],
      ['Mín. animais', 3, ['C2', 'C4']],
    ]
    for (const [label, v, expected] of cases) {
      await setMin(page, label, v)
      const got = await visibleMine(page)
      rec(`RES-122/${label}=${v}`, setsEqual(got, expected) ? 'OK' : 'DIVERGE', `esperado=${expected} obtido=${got}`)
      await setMin(page, label, '')
    }
    // RES-123: mínimo 0 inclui quem informou 0 e exclui quem não informou
    await setMin(page, 'Mín. total de pessoas', 0)
    const got0 = await visibleMine(page)
    rec('RES-123/min-0', setsEqual(got0, ['C1', 'C2', 'C4', 'C5']) ? 'OK' : 'DIVERGE', `mín. total=0: obtido=${got0} (C3 e C6 não informaram)`)
    // mapa acompanha: marcadores == cards
    const markers = await page.locator('[data-testid^="rescue-request-marker-"]').count()
    const cards = await page.locator('.rescue-requests-list .v-card').count()
    rec('RES-123/mapa-acompanha', markers === cards ? 'OK' : 'DIVERGE', `marcadores=${markers} cards=${cards}`)
    // valores inválidos digitados no filtro
    await setMin(page, 'Mín. total de pessoas', -1)
    rec('EXTRA/filtro-negativo', 'OBS', `mín. total=-1: alerta="${flat(await alertText(page))}" cards=${await page.locator('.rescue-requests-list .v-card').count()}`)
    await L.shot(page, 'extra-filtro-negativo')
    await setMin(page, 'Mín. total de pessoas', '1.5')
    rec('EXTRA/filtro-decimal', 'OBS', `mín. total=1.5: alerta="${flat(await alertText(page))}"`)
    // RES-115: limpar filtros
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await L.sleep(1500)
    const all = await visibleMine(page)
    rec('RES-115', setsEqual(all, Object.keys(names)) && !(await alertText(page)) ? 'OK' : 'DIVERGE', `após "Limpar filtros": visíveis=${all} alerta="${flat(await alertText(page))}"`)
    await context.close()
  })

  // ---------- RES-109 / RES-124: ordenação ----------
  await step('RES-109', async () => {
    const { context, page } = await openPanel()
    // data/hora
    await pickSelect(page, 'Ordenar por', 'Data/hora do pedido')
    await page.locator('button:has(i.mdi-sort-ascending)').click(); await L.sleep(1200)
    const asc = await orderMine(page)
    await page.locator('button:has(i.mdi-sort-descending)').click(); await L.sleep(1200)
    const desc = await orderMine(page)
    rec('RES-109', JSON.stringify(asc) === JSON.stringify(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) && JSON.stringify(desc) === JSON.stringify(['C6', 'C5', 'C4', 'C3', 'C2', 'C1']) ? 'OK' : 'DIVERGE', `data asc=${asc} desc=${desc}`)
    // quantidade: quem não informou fica no fim nas duas direções
    await pickSelect(page, 'Ordenar por', 'Total de pessoas')
    await page.locator('button:has(i.mdi-sort-ascending)').click(); await L.sleep(1200)
    const qa = await orderMine(page)
    await page.locator('button:has(i.mdi-sort-descending)').click(); await L.sleep(1200)
    const qd = await orderMine(page)
    const nullsLast = (o) => o.slice(-2).every((k) => ['C3', 'C6'].includes(k))
    rec('RES-124', qa.slice(0, 4).join() === 'C5,C2,C1,C4' && qd.slice(0, 4).join() === 'C4,C1,C2,C5' && nullsLast(qa) && nullsLast(qd) ? 'OK' : 'DIVERGE', `total asc=${qa} desc=${qd}`)
    // ordenar por categoria
    await pickSelect(page, 'Ordenar por', 'Animais')
    await page.locator('button:has(i.mdi-sort-descending)').click(); await L.sleep(1200)
    const an = await orderMine(page)
    rec('RES-124/animais-desc', an.slice(0, 3).join() === 'C4,C2,C1' ? 'OK' : 'DIVERGE', `animais desc=${an} (C4=5, C2=3, C1=0, C5=0, C3/C6=nulo)`)
    await context.close()
  })

  // ---------- RES-110: filtro por status reflete no mapa ----------
  await step('RES-110', async () => {
    // cancela C5 pela API para ter um status diferente (dado meu)
    await api(`/api/rescue-requests/${mine.C5.id}/cancel`, { method: 'POST', token: adm.token, body: { cancellation_reason: 'EXPLORATORIO: cancelado para o charter C' } })
    const { context, page } = await openPanel()
    await pickSelect(page, 'Status', 'Cancelado')
    const cards = await page.locator('.rescue-requests-list .v-card').count()
    const ids = await page.$$eval('[data-testid^="rescue-request-marker-"]', (els) => els.map((e) => Number(e.getAttribute('data-testid').split('-').pop())))
    const c5visible = ids.includes(mine.C5.id)
    const c1visible = ids.includes(mine.C1.id)
    rec('RES-110', ids.length === cards && c5visible && !c1visible ? 'OK' : 'DIVERGE', `status=Cancelado: cards=${cards} marcadores=${ids.length} marcador-C5=${c5visible} marcador-C1(pendente)=${c1visible}`)
    // estado vazio
    await pickSelect(page, 'Status', 'Concluído')
    const empty = flat(await listText(page))
    const mk = await page.locator('[data-testid^="rescue-request-marker-"]').count()
    rec('EXTRA/estado-vazio', 'OBS', `status=Concluído: lista="${empty.slice(0, 80)}" marcadores=${mk}`)
    await context.close()
  })

  // ---------- RES-111 / RES-112: seleção e tooltip ----------
  await step('RES-111', async () => {
    const { context, page } = await openPanel()
    const card = (k) => page.locator('.rescue-requests-list .v-card', { hasText: names[k] })
    const marker = (k) => page.getByTestId(`rescue-request-marker-${mine[k].id}`)
    const size = (k) => marker(k).locator('span').first().evaluate((e) => e.style.width)
    const before = { C1: await size('C1'), C2: await size('C2') }
    await card('C1').click(); await L.sleep(700)
    const s1 = { C1: await size('C1'), C2: await size('C2') }
    const tips1 = await page.locator('.leaflet-tooltip').allInnerTexts()
    await card('C2').click(); await L.sleep(700)
    const s2 = { C1: await size('C1'), C2: await size('C2') }
    const tips2 = await page.locator('.leaflet-tooltip').allInnerTexts()
    const highlighted1 = s1.C1 !== before.C1 && s1.C2 === before.C2
    const swapped = s2.C2 !== before.C2 && s2.C1 === before.C1
    rec('RES-111/marcador', highlighted1 && swapped ? 'OK' : 'DIVERGE', `largura antes=${JSON.stringify(before)} sel.C1=${JSON.stringify(s1)} sel.C2=${JSON.stringify(s2)}`)
    rec('RES-111/tooltip', tips1.length === 1 && tips2.length === 1 && /10 pessoa/.test(tips1[0]) && /4 pessoa/.test(tips2[0]) ? 'OK' : 'DIVERGE', `tooltips após C1=${JSON.stringify(tips1)} após C2=${JSON.stringify(tips2)}`)
    await L.shot(page, 'res111-selecao')
    // clicar no marcador seleciona o card
    await marker('C4').click({ force: true }); await L.sleep(700)
    const c4tonal = await card('C4').evaluate((e) => e.className.includes('v-card--variant-tonal'))
    rec('EXTRA/clicar-no-marcador', c4tonal ? 'OK' : 'OBS', `clicar no marcador destaca o card na lista=${c4tonal}`)
    // RES-112: hover mostra data/hora
    await page.mouse.move(5, 5)
    const cardDate = flat(await card('C3').innerText()).match(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/)?.[0]
    await marker('C3').hover({ force: true }); await L.sleep(500)
    const tip = flat((await page.locator('.leaflet-tooltip').allInnerTexts()).join(' | '))
    rec('RES-112', tip.includes('?') && cardDate && tip.includes(cardDate) ? 'OK' : 'DIVERGE', `tooltip="${tip}" data-do-card="${cardDate}" (C3 sem total informado deve mostrar "?")`)
    await context.close()
  })

  // ---------- RES-113 / RES-114: enquadramento e não-reposicionamento ----------
  await step('RES-113', async () => {
    const { context, page } = await openPanel()
    await L.sleep(1200)
    const mapBox = await page.locator('.panel-map').boundingBox()
    const boxes = await page.$$eval('[data-testid^="rescue-request-marker-"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-testid').split('-').pop(), x: r.x + r.width / 2, y: r.y + r.height / 2 } }))
    const outside = boxes.filter((m) => m.x < mapBox.x || m.x > mapBox.x + mapBox.width || m.y < mapBox.y || m.y > mapBox.y + mapBox.height)
    const lis = boxes.find((m) => Number(m.id) === far.id)
    rec('RES-113', outside.length === 0 && !!lis ? 'OK' : 'DIVERGE', `1ª carga com pedidos em SP e Lisboa: marcadores=${boxes.length} fora-da-área-do-mapa=${outside.length} lisboa-visível=${!!lis}`)
    await L.shot(page, 'res113-enquadramento')

    // RES-114: mudar status pela UI e mudar filtro não reposicionam
    const pos = async (k) => { const r = await page.getByTestId(`rescue-request-marker-${mine[k].id}`).boundingBox(); return r ? { x: Math.round(r.x), y: Math.round(r.y) } : null }
    // o operador afasta o zoom manualmente antes
    await page.locator('.panel-map').hover()
    await page.mouse.wheel(0, 400); await L.sleep(1000)
    const p0 = await pos('C1')
    await page.getByRole('button', { name: 'Atualizar' }).click(); await L.sleep(1500)
    const p1 = await pos('C1')
    rec('RES-114/atualizar-apos-zoom-manual', JSON.stringify(p0) === JSON.stringify(p1) ? 'OK' : 'DIVERGE', `posição do marcador C1 antes=${JSON.stringify(p0)} depois de Atualizar=${JSON.stringify(p1)}`)
    // assumir C1 pela UI (dado meu)
    await page.locator('.rescue-requests-list .v-card', { hasText: names.C1 }).getByRole('button', { name: 'Assumir' }).click(); await L.sleep(1500)
    const p2 = await pos('C1')
    rec('RES-114/apos-assumir', JSON.stringify(p1) === JSON.stringify(p2) ? 'OK' : 'DIVERGE', `posição depois de assumir=${JSON.stringify(p2)}`)
    await pickSelect(page, 'Status', 'Em resgate')
    const p3 = await pos('C1')
    rec('RES-114/apos-filtro', JSON.stringify(p2) === JSON.stringify(p3) ? 'OK' : 'DIVERGE', `posição depois de filtrar por status=${JSON.stringify(p3)}`)
    await context.close()
  })

  // ---------- RES-99: compartilhar ----------
  await step('RES-99', async () => {
    const shareInit = () => { window.__shared = null; navigator.share = async (d) => { window.__shared = d } }
    let c = await L.newCtx(b, {}, session)
    await c.context.addInitScript(shareInit)
    await c.page.goto(BASE + '/painel'); await c.page.locator('.rescue-requests-list .v-card').first().waitFor()
    const card = c.page.locator('.rescue-requests-list .v-card', { hasText: names.C4 })
    await card.getByRole('button', { name: 'Compartilhar localização' }).click(); await L.sleep(800)
    const shared = await c.page.evaluate(() => window.__shared)
    const snack = await c.page.getByText('Localização copiada para a área de transferência.').count()
    rec('RES-99/navigator.share', shared?.url?.includes('-23.5505') ? 'OK' : 'DIVERGE', `share chamado com=${JSON.stringify(shared)} snackbar-de-cópia=${snack}`)
    await c.context.close()

    // sem share e sem clipboard (ex.: implantação em HTTP puro): há algum feedback?
    c = await L.newCtx(b, {}, session)
    await c.context.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }) })
    await c.page.goto(BASE + '/painel'); await c.page.locator('.rescue-requests-list .v-card').first().waitFor()
    await c.page.locator('.rescue-requests-list .v-card', { hasText: names.C4 }).getByRole('button', { name: 'Compartilhar localização' }).click(); await L.sleep(1200)
    const feedback = await c.page.locator('.v-snackbar, .v-alert').count()
    rec('EXTRA/compartilhar-sem-clipboard', 'OBS', `sem navigator.share e sem navigator.clipboard: elementos de feedback na tela=${feedback} erros=[${c.page.errors.join(' | ')}]`)
    await c.context.close()

    // clipboard negado
    c = await L.newCtx(b, {}, session)
    await c.context.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); navigator.clipboard.writeText = () => Promise.reject(new Error('negado')) })
    await c.page.goto(BASE + '/painel'); await c.page.locator('.rescue-requests-list .v-card').first().waitFor()
    await c.page.locator('.rescue-requests-list .v-card', { hasText: names.C4 }).getByRole('button', { name: 'Compartilhar localização' }).click(); await L.sleep(1200)
    const snackDenied = await c.page.getByText('Localização copiada para a área de transferência.').count()
    const feedback2 = await c.page.locator('.v-snackbar:visible, .v-alert').count()
    rec('EXTRA/compartilhar-clipboard-negado', 'OBS', `clipboard rejeita a cópia: snackbar de sucesso=${snackDenied} outros-feedbacks=${feedback2}`)
    await c.context.close()
  })

  // ---------- celular ----------
  await step('C-mobile', async () => {
    const { context, page } = await openPanel({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    const map = await page.locator('.panel-map').boundingBox()
    const list = await page.locator('.panel-list').boundingBox()
    rec('C-mobile', m.sw <= m.iw ? 'OK' : 'DIVERGE', `375x667: scrollWidth=${m.sw} innerWidth=${m.iw} mapa=${Math.round(map.width)}x${Math.round(map.height)} lista=${Math.round(list.width)}x${Math.round(list.height)} erros=[${page.errors.join(' | ')}]`)
    await L.shot(page, 'c-mobile-painel')
    await context.close()
  })

  // ---------- erros silenciosos ----------
  await step('C-console', async () => {
    const { context, page } = await openPanel()
    await L.sleep(1500)
    rec('C-console', 'OBS', `painel após carga: erros-console=[${page.errors.join(' | ')}] http>=400=[${page.http.join(', ')}]`)
    await context.close()
  })

  await b.close()
  console.log('FIM charter C')
})().catch((e) => { console.error('ERRO GERAL', e); process.exit(1) })
