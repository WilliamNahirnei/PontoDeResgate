const L = require('/work/lib.cjs')
const { BASE, rec, api, TAG } = L

async function step(id, fn) {
  try { await fn() } catch (e) { rec(id, 'ERRO-DO-SCRIPT', String(e.message).split('\n')[0].slice(0, 220)) }
}
const alertText = (page) => page.locator('.v-alert').first().innerText().catch(() => '')
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
const selText = (page) => page.getByText(/Localização selecionada/).first().innerText().catch(() => '')
const clickMap = (page, x = 150, y = 150) => page.locator('.location-picker-map').click({ position: { x, y } })

async function findByName(adminToken, name) {
  const r = await api('/api/rescue-requests', { token: adminToken })
  return (r.json?.data ?? []).filter((x) => x.requester_name === name)
}

;(async () => {
  const b = await L.launch()
  const adm = await L.adminLogin()

  // ---------- RES-79: tela pública não cita nem linka a área do operador ----------
  await step('RES-79', async () => {
    for (const [label, session] of [['sem sessão', null], ['com sessão de operador salva', { token: adm.token, user: adm.user }]]) {
      const { context, page } = await L.newCtx(b, {}, session)
      await page.goto(BASE + '/')
      await L.sleep(800)
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))
      const text = await page.locator('body').innerText()
      const words = (text.match(/painel|login|entrar|operador|admin|sair/gi) || [])
      const bar = await page.locator('.v-app-bar').count()
      rec(`RES-79/${label}`, hrefs.length === 0 && words.length === 0 && bar === 0 ? 'OK' : 'DIVERGE',
        `links=${JSON.stringify(hrefs)} palavras=${JSON.stringify(words)} app-bar=${bar}`)
      await context.close()
    }
  })

  // ---------- RES-80: geolocalização negada/indisponível ----------
  await step('RES-80', async () => {
    const { context, page } = await L.newCtx(b) // sem permissão de geolocalização
    await page.goto(BASE + '/')
    await L.sleep(2500)
    const before = await selText(page)
    const disabled = await page.getByRole('button', { name: 'Enviar pedido' }).isDisabled()
    rec('RES-80/sem-pin-automatico', before === '' && disabled ? 'OK' : 'DIVERGE', `pin automático="${before}" botão-desabilitado=${disabled} erros=[${page.errors.join(' | ')}]`)
    await clickMap(page)
    const after = await selText(page)
    const enabled = await page.getByRole('button', { name: 'Enviar pedido' }).isEnabled()
    rec('RES-80/marcacao-manual', /Localização selecionada/.test(after) && enabled ? 'OK' : 'DIVERGE', `após clicar no mapa: "${flat(after)}" botão-habilitado=${enabled}`)
    // sem navigator.geolocation (indisponível)
    const c2 = await L.newCtx(b)
    await c2.context.addInitScript(() => { Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }) })
    await c2.page.goto(BASE + '/')
    await L.sleep(1500)
    rec('RES-80/geolocation-indisponivel', (await selText(c2.page)) === '' ? 'OK' : 'DIVERGE', `sem navigator.geolocation: pin="${await selText(c2.page)}" erros=[${c2.page.errors.join(' | ')}]`)
    await c2.context.close()
    await context.close()
  })

  // ---------- RES-81: ajustar o pin depois da geolocalização ----------
  await step('RES-81', async () => {
    const { context, page } = await L.newCtx(b, { geolocation: { latitude: -22.9068, longitude: -43.1729 }, permissions: ['geolocation'] })
    await page.goto(BASE + '/')
    await page.getByText(/Localização selecionada: -22\.90680/).waitFor({ timeout: 8000 })
    const initial = flat(await selText(page))
    const marker = page.locator('.leaflet-marker-draggable').first()
    const box = await marker.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 10 })
    await page.mouse.up()
    await L.sleep(500)
    const dragged = flat(await selText(page))
    await clickMap(page, 60, 60)
    const clicked = flat(await selText(page))
    rec('RES-81', initial !== dragged && dragged !== clicked ? 'OK' : 'DIVERGE', `inicial="${initial}" | após arrastar="${dragged}" | após clicar no mapa="${clicked}"`)
    await L.shot(page, 'res81-pin-ajustado')
    await context.close()
  })

  // ---------- RES-125 + RES-102 + entradas hostis ----------
  const nome = `${TAG} B125 ${Date.now()}`
  const ref = `Perto do "mercado" <b>azul</b> & cia ção ñ 🚒`
  await step('RES-125/102', async () => {
    const { context, page } = await L.newCtx(b)
    await page.goto(BASE + '/')
    await clickMap(page)
    await page.getByLabel('Nome (opcional)').fill(nome)
    await page.getByLabel('Total de pessoas').fill('7')
    await page.getByLabel('Homens').fill('2')
    await page.getByLabel('Mulheres').fill('3')
    await page.getByLabel('Crianças').fill('1')
    await page.getByLabel('Idosos').fill('1')
    await page.getByLabel('Animais').fill('2')
    await page.getByLabel('Ponto de referência (opcional)').fill(ref)
    await page.getByRole('button', { name: 'Enviar pedido' }).click()
    await page.getByText('Pedido enviado com sucesso.').waitFor({ timeout: 8000 })
    const okText = flat(await page.locator('.v-container').innerText())
    const hasIdOrStatus = /pendente|#\d+|id\b|protocolo|número/i.test(okText)
    rec('RES-102/confirmacao', !hasIdOrStatus ? 'OK' : 'DIVERGE', `texto da tela após envio: "${okText.slice(0, 160)}"`)
    await page.getByRole('button', { name: 'Enviar novo pedido' }).click()
    await L.sleep(600)
    const vals = await page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((i) => i.value))
    const pinAfter = await selText(page)
    const disabled = await page.getByRole('button', { name: 'Enviar pedido' }).isDisabled()
    rec('RES-102/novo-pedido', vals.every((v) => v === '') && pinAfter === '' && disabled ? 'OK' : 'DIVERGE', `campos=${JSON.stringify(vals)} pin="${pinAfter}" botão-desabilitado=${disabled}`)
    await context.close()

    // o que o operador vê
    const c2 = await L.newCtx(b, {}, { token: adm.token, user: adm.user })
    await c2.page.goto(BASE + '/painel')
    const card = c2.page.locator('.rescue-requests-list .v-card', { hasText: nome })
    await card.waitFor({ timeout: 8000 })
    const cardText = flat(await card.innerText())
    const bTags = await card.locator('b').count()
    rec('RES-125/card', 'OBS', `card do operador: "${cardText}" | tags <b> renderizadas=${bTags}`)
    const seen = { total: /7 pessoa/.test(cardText), animais: /2 animal/.test(cardText), referencia: cardText.includes('mercado'), homens: /homens?\b|\b2 hom/i.test(cardText), mulheres: /mulher/i.test(cardText), criancas: /crian/i.test(cardText), idosos: /idos/i.test(cardText) }
    rec('RES-125/campos-visiveis', Object.values(seen).every(Boolean) ? 'OK' : 'DIVERGE', `visíveis no card: ${JSON.stringify(seen)}`)
    await L.shot(c2.page, 'res125-card-painel')
    await c2.context.close()
  })

  // ---------- entradas hostis (números, textos) ----------
  await step('B-hostil', async () => {
    const cases = [
      ['negativo', { total: '-5' }],
      ['decimal', { total: '2.5' }],
      ['gigante', { total: '99999999999' }],
      ['nome-300', { nome: 'N'.repeat(300) }],
      ['referencia-1001', { ref: 'R'.repeat(1001) }],
      ['nome-espacos', { nome: '   ' }],
    ]
    for (const [label, c] of cases) {
      const { context, page } = await L.newCtx(b)
      await page.goto(BASE + '/')
      await clickMap(page)
      const marcador = `${TAG} hostil-${label} ${Date.now()}`
      if (c.nome === undefined) await page.getByLabel('Nome (opcional)').fill(marcador)
      else await page.getByLabel('Nome (opcional)').fill(c.nome)
      if (c.total !== undefined) await page.getByLabel('Total de pessoas').fill(c.total)
      if (c.ref !== undefined) await page.getByLabel('Ponto de referência (opcional)').fill(c.ref)
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await L.sleep(1500)
      const ok = await page.getByText('Pedido enviado com sucesso.').count()
      const msg = flat(await alertText(page))
      rec(`B-hostil/${label}`, 'OBS', `enviado=${ok > 0} mensagem="${msg.slice(0, 110)}" http=[${page.http.join(', ')}]`)
      await context.close()
    }
  })

  // ---------- duplo clique em Enviar (rede lenta) ----------
  await step('B-duplo-clique', async () => {
    const { context, page } = await L.newCtx(b)
    await page.route('**/api/rescue-requests', async (route) => {
      if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1500))
      await route.continue()
    })
    const marcador = `${TAG} duplo-clique ${Date.now()}`
    await page.goto(BASE + '/')
    await clickMap(page)
    await page.getByLabel('Nome (opcional)').fill(marcador)
    const btn = page.getByRole('button', { name: 'Enviar pedido' })
    await btn.click()
    await btn.click({ force: true, timeout: 1000 }).catch(() => {})
    await btn.click({ force: true, timeout: 1000 }).catch(() => {})
    await page.getByText('Pedido enviado com sucesso.').waitFor({ timeout: 10000 }).catch(() => {})
    await L.sleep(2500)
    const n = (await findByName(adm.token, marcador)).length
    rec('B-duplo-clique', n === 1 ? 'OK' : 'DIVERGE', `3 cliques em "Enviar pedido" com rede lenta -> pedidos criados=${n}`)
    await context.close()
  })

  // ---------- RES-103: falha no envio preserva os dados ----------
  await step('RES-103', async () => {
    for (const modo of ['rede-caiu', 'erro-500']) {
      const { context, page } = await L.newCtx(b)
      await page.route('**/api/rescue-requests', (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        return modo === 'rede-caiu' ? route.abort('failed') : route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Server Error"}' })
      })
      const marcador = `${TAG} falha-${modo} ${Date.now()}`
      await page.goto(BASE + '/')
      await clickMap(page)
      await page.getByLabel('Nome (opcional)').fill(marcador)
      await page.getByLabel('Total de pessoas').fill('4')
      await page.getByLabel('Ponto de referência (opcional)').fill('ref falha')
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      await L.sleep(1500)
      const msg = flat(await alertText(page))
      const kept = { nome: await page.getByLabel('Nome (opcional)').inputValue(), total: await page.getByLabel('Total de pessoas').inputValue(), ref: await page.getByLabel('Ponto de referência (opcional)').inputValue(), pin: await selText(page) }
      const preserved = kept.nome === marcador && kept.total === '4' && kept.ref === 'ref falha' && /Localização/.test(kept.pin)
      // tenta de novo com a rede de volta
      await page.unroute('**/api/rescue-requests')
      await page.getByRole('button', { name: 'Enviar pedido' }).click()
      const retry = await page.getByText('Pedido enviado com sucesso.').waitFor({ timeout: 6000 }).then(() => true).catch(() => false)
      const criados = (await findByName(adm.token, marcador)).length
      rec(`RES-103/${modo}`, preserved && msg && retry && criados === 1 ? 'OK' : 'DIVERGE', `mensagem="${msg}" dados-preservados=${preserved} reenvio-ok=${retry} pedidos-criados=${criados}`)
      await L.shot(page, `res103-${modo}`)
      await context.close()
    }
  })

  // ---------- celular ----------
  await step('B-mobile', async () => {
    const { context, page } = await L.newCtx(b, { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    await page.goto(BASE + '/')
    await L.sleep(1200)
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, btn: !!document.querySelector('button[type=submit]') }))
    const btnBox = await page.getByRole('button', { name: 'Enviar pedido' }).boundingBox()
    rec('B-mobile', m.sw <= m.iw ? 'OK' : 'DIVERGE', `375x667: scrollWidth=${m.sw} innerWidth=${m.iw} botão-enviar y=${Math.round(btnBox?.y ?? -1)} (fora da 1ª tela=${(btnBox?.y ?? 0) > 667}) erros-console=[${page.errors.join(' | ')}]`)
    await L.shot(page, 'b-mobile')
    await context.close()
  })

  // ---------- erros silenciosos na carga ----------
  await step('B-console', async () => {
    const { context, page } = await L.newCtx(b)
    await page.goto(BASE + '/')
    await L.sleep(2500)
    rec('B-console', 'OBS', `carga da tela pública: erros-console=[${page.errors.join(' | ')}] http>=400=[${page.http.join(', ')}]`)
    await context.close()
  })

  await b.close()
  console.log('FIM charter B')
})().catch((e) => { console.error('ERRO GERAL', e); process.exit(1) })
