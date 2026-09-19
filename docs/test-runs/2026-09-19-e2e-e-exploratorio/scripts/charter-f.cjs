const L = require('/work/lib.cjs')
const { BASE, api, TAG, rec } = L
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin(); const stamp = Date.now()
  const session = { token: adm.token, user: adm.user }

  // ---- injeção de HTML/JS em nome, referência e nome de operador ----
  const payload = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`
  const r = await L.mkRequest(adm.token, { requester_name: `${TAG} XSS ${stamp} ${payload}`, reference_point: `ref ${payload}`, total_people: 1, latitude: -20.5, longitude: -54.6 })
  await api('/api/operators', { method: 'POST', token: adm.token, body: { name: `${TAG} XSSOP ${stamp} ${payload}`, email: `exploratorio.xss.${stamp}@pontoderesgate.local`, password: 'senha-explo-123' } })
  const opx = await L.login(`exploratorio.xss.${stamp}@pontoderesgate.local`, 'senha-explo-123')
  await api(`/api/rescue-requests/${r.id}/assume`, { method: 'POST', token: opx.token }) // gera log e operador com payload
  const { page } = await L.newCtx(b, {}, session)
  const seen = {}
  for (const [k, p] of [['painel', '/painel'], ['logs', '/painel/logs'], ['operadores', '/painel/operadores']]) {
    await page.goto(BASE + p); await L.sleep(2200)
    if (p === '/painel/operadores') { await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill('XSSOP'); await L.sleep(1500) }
    if (p === '/painel') { await page.locator('.rescue-requests-list .v-card', { hasText: 'XSS' }).first().click().catch(() => {}); await L.sleep(500) }
    seen[k] = { xss: await page.evaluate(() => window.__xss || 0), imgs: await page.locator('img[src="x"]').count() }
  }
  rec('F-xss', Object.values(seen).every((s) => s.xss === 0 && s.imgs === 0) ? 'OK' : 'DIVERGE', `HTML injetado em nome/referência/operador -> ${JSON.stringify(seen)}`)

  // ---- rota inexistente ----
  for (const p of ['/nao-existe', '/painel/nao-existe']) {
    const c = await L.newCtx(b, {}, p.startsWith('/painel') ? session : null)
    await c.page.goto(BASE + p); await L.sleep(800)
    const txt = flat(await c.page.locator('body').innerText())
    rec(`F-rota-inexistente${p}`, 'OBS', `url=${new URL(c.page.url()).pathname} texto-visível="${txt.slice(0, 60)}" (vazio=${txt === ''})`)
    await L.shot(c.page, 'f-rota-inexistente' + p.replace(/\//g, '-'))
    await c.context.close()
  }

  // ---- limite de tentativas de login (e-mail inexistente, sem afetar contas reais) ----
  const codes = []
  for (let i = 0; i < 15; i++) codes.push((await api('/api/login', { method: 'POST', body: { email: `nao.existe.${stamp}@pontoderesgate.local`, password: 'errada' + i } })).status)
  rec('F-login-sem-limite', 'OBS', `15 logins errados seguidos -> códigos=${[...new Set(codes)].join(',')} (429 presente=${codes.includes(429)})`)

  // ---- envio público em rajada ----
  const burst = []
  for (let i = 0; i < 12; i++) burst.push((await api('/api/rescue-requests', { method: 'POST', body: { latitude: -1 - i / 100, longitude: -50, requester_name: `${TAG} rajada ${stamp} ${i}` } })).status)
  rec('F-envio-publico-em-rajada', 'OBS', `12 envios públicos seguidos do mesmo cliente -> códigos=${[...new Set(burst)].join(',')} (429 presente=${burst.includes(429)})`)

  // ---- lat/lng nos limites e fora ----
  const lim = []
  for (const [la, lo] of [[90, 180], [-90, -180], [90.0001, 0], [0, 180.0001], ['abc', 0]]) lim.push(`${la},${lo}=${(await api('/api/rescue-requests', { method: 'POST', body: { latitude: la, longitude: lo, requester_name: `${TAG} limite ${stamp}` } })).status}`)
  rec('F-coordenadas-limites', 'OBS', lim.join(' '))
  await b.close()
})()
