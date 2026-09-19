const L = require('/work/lib.cjs')
const { BASE, rec, TAG } = L
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin()
  const session = { token: adm.token, user: adm.user }
  const stamp = Date.now()
  // pedido em coordenada única (Manaus) para hover/clique não caírem em marcador empilhado
  const uniq = await L.mkRequest(adm.token, { requester_name: `${TAG} Cunico ${stamp}`, latitude: -3.119, longitude: -60.0217, total_people: 3 })
  const { context, page } = await L.newCtx(b, {}, session)
  await page.goto(BASE + '/painel'); await page.locator('.rescue-requests-list .v-card').first().waitFor(); await L.sleep(1500)
  const card = page.locator('.rescue-requests-list .v-card', { hasText: uniq.name })
  const marker = page.getByTestId(`rescue-request-marker-${uniq.id}`)

  // RES-112: tooltip com data/hora (marcador único)
  const cardDate = flat(await card.innerText()).match(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/)?.[0]
  await marker.hover(); await L.sleep(600)
  const tip = flat((await page.locator('.leaflet-tooltip').allInnerTexts()).join(' | '))
  L.rec('RES-112', /3 pessoa\(s\)/.test(tip) && cardDate && tip.includes(cardDate) ? 'OK' : 'DIVERGE', `tooltip="${tip}" data-do-card="${cardDate}"`)

  // clicar no marcador destaca o card?
  await page.mouse.move(2, 2)
  await marker.click(); await L.sleep(700)
  const tonal = await card.evaluate((e) => e.className.includes('v-card--variant-tonal'))
  L.rec('EXTRA/clicar-no-marcador', tonal ? 'OK' : 'OBS', `marcador único clicado -> card destacado na lista=${tonal}`)

  // marcadores empilhados
  const stacked = await page.$$eval('[data-testid^="rescue-request-marker-"]', (els) => { const m = {}; els.forEach((e) => { const r = e.getBoundingClientRect(); const k = `${Math.round(r.x)},${Math.round(r.y)}`; m[k] = (m[k] || 0) + 1 }); return Object.entries(m).sort((a, c) => c[1] - a[1])[0] })
  L.rec('EXTRA/marcadores-empilhados', 'OBS', `maior pilha de marcadores na mesma posição da tela=${stacked?.[1]} (total de marcadores=${await page.locator('[data-testid^="rescue-request-marker-"]').count()})`)

  // Limpar filtros duplicado?
  await page.getByRole('button', { name: 'Filtrar por quantidade' }).click(); await L.sleep(500)
  const n = await page.getByRole('button', { name: 'Limpar filtros' }).count()
  const vis = await page.getByRole('button', { name: 'Limpar filtros' }).evaluateAll((els) => els.map((e) => `${e.offsetParent !== null ? 'visível' : 'oculto'}`))
  L.rec('EXTRA/limpar-filtros-duplicado', 'OBS', `botões "Limpar filtros" no DOM=${n} (${vis.join(',')})`)

  // RES-115 com o botão visível
  await page.getByLabel('Mín. animais').fill('3'); await L.sleep(1300)
  const filtrada = await page.locator('.rescue-requests-list .v-card').count()
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click(); await L.sleep(1500)
  const limpa = await page.locator('.rescue-requests-list .v-card').count()
  const vals = await page.$$eval('input[type=number]', (els) => els.map((e) => e.value).join(','))
  L.rec('RES-115', limpa > filtrada && vals.replace(/,/g, '') === '' ? 'OK' : 'DIVERGE', `com "Mín. animais"=3: ${filtrada} cards; após Limpar filtros: ${limpa} cards; campos=[${vals}]`)

  // estado vazio
  await page.getByLabel('Mín. animais').fill('999999'); await L.sleep(1300)
  const txt = flat(await page.locator('.rescue-requests-list').innerText())
  const mk = await page.locator('[data-testid^="rescue-request-marker-"]').count()
  L.rec('EXTRA/estado-vazio', /Nenhum pedido encontrado\./.test(txt) && mk === 0 ? 'OK' : 'DIVERGE', `filtro sem resultado: lista="${txt.slice(0, 60)}" marcadores=${mk}`)
  await context.close(); await b.close()
})()
