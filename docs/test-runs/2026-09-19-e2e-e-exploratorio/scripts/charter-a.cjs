const L = require('/work/lib.cjs')
const { BASE, rec, api } = L

async function step(id, fn) {
  try { await fn() } catch (e) { rec(id, 'ERRO-DO-SCRIPT', String(e.message).split('\n')[0].slice(0, 200)) }
}
const alertText = (page) => page.locator('.v-alert').first().innerText().catch(() => '')
const path = (page) => new URL(page.url()).pathname

;(async () => {
  const b = await L.launch()
  const adm = await L.adminLogin()
  const adminSession = { token: adm.token, user: adm.user }

  // ---------- USR-70: visitante nas rotas de admin ----------
  await step('USR-70', async () => {
    const out = []
    for (const p of ['/painel', '/painel/operadores', '/painel/operadores/novo', '/painel/logs']) {
      const { context, page } = await L.newCtx(b)
      await page.goto(BASE + p)
      await L.sleep(500)
      out.push(`${p} -> ${path(page)}`)
      await context.close()
    }
    const ok = out.every((s) => s.endsWith('-> /login'))
    rec('USR-70', ok ? 'OK' : 'DIVERGE', out.join(' ; '))
  })

  // ---------- USR-72 / USR-73: desativado não entra; reativado volta ----------
  const o1 = await L.mkOperator(adm.token, 'A1-desativar')
  await step('USR-72/73', async () => {
    const { context, page } = await L.newCtx(b, {}, adminSession)
    await page.goto(BASE + '/painel/operadores')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(o1.name)
    const row = page.getByRole('row', { name: new RegExp(o1.name) })
    await row.getByRole('button', { name: 'Desativar' }).click()
    await page.getByText('Operador desativado com sucesso.').waitFor({ timeout: 5000 })

    const c2 = await L.newCtx(b)
    await L.uiLogin(c2.page, o1.email, o1.password)
    await L.sleep(1500)
    const msg = await alertText(c2.page)
    rec('USR-72', path(c2.page) === '/login' ? 'OK' : 'DIVERGE',
      `desativado tentou entrar: url=${path(c2.page)} mensagem="${msg.replace(/\s+/g, ' ')}"`)
    await L.shot(c2.page, 'usr72-desativado-login')
    await c2.context.close()

    await row.getByRole('button', { name: 'Ativar' }).click()
    await page.getByText('Operador ativado com sucesso.').waitFor({ timeout: 5000 })
    const c3 = await L.newCtx(b)
    await L.uiLogin(c3.page, o1.email, o1.password)
    await L.sleep(1500)
    rec('USR-73', path(c3.page) === '/painel' ? 'OK' : 'DIVERGE', `reativado tentou entrar: url=${path(c3.page)}`)
    await c3.context.close()
    await context.close()
  })

  // ---------- USR-74: cadastro pela UI -> novo operador entra e não vê menus de admin ----------
  const stamp = Date.now()
  const novo = { name: `${L.TAG} A74 ${stamp}`, email: `exploratorio.a74.${stamp}@pontoderesgate.local`, password: 'senha-explo-123' }
  await step('USR-74', async () => {
    const { context, page } = await L.newCtx(b, {}, adminSession)
    await page.goto(BASE + '/painel/operadores/novo')
    await page.getByLabel('Nome').fill(novo.name)
    await page.getByLabel('E-mail').fill(novo.email)
    await page.getByLabel('Senha').fill(novo.password)
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await page.waitForURL(/\/painel\/operadores$/, { timeout: 5000 })
    await context.close()

    const c2 = await L.newCtx(b)
    await L.uiLogin(c2.page, novo.email, novo.password)
    await c2.page.waitForURL(/\/painel$/, { timeout: 5000 })
    const bar = c2.page.locator('.v-app-bar')
    const menus = { Painel: await bar.getByText('Painel', { exact: true }).count(), Operadores: await bar.getByText('Operadores', { exact: true }).count(), Logs: await bar.getByText('Logs', { exact: true }).count(), Sair: await bar.getByText('Sair', { exact: true }).count() }
    await c2.page.goto(BASE + '/painel/operadores')
    await L.sleep(500)
    const redirect = path(c2.page)
    await c2.page.goto(BASE + '/painel/logs')
    await L.sleep(500)
    const redirect2 = path(c2.page)
    const ok = menus.Operadores === 0 && menus.Logs === 0 && redirect === '/painel' && redirect2 === '/painel'
    rec('USR-74', ok ? 'OK' : 'DIVERGE', `menus=${JSON.stringify(menus)} /painel/operadores->${redirect} /painel/logs->${redirect2}`)
    await c2.context.close()
  })

  // ---------- USR-75 / USR-69: validação do cadastro ----------
  await step('USR-75', async () => {
    const { context, page } = await L.newCtx(b, {}, adminSession)
    const count = async (email) => (await api(`/api/operators?email=${encodeURIComponent(email)}`, { token: adm.token })).json?.data?.length ?? -1

    // vazio
    await page.goto(BASE + '/painel/operadores/novo')
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await L.sleep(800)
    const valMissing = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => `${i.type}:${i.validity.valueMissing}`).join(','))
    rec('USR-75/vazio', path(page) === '/painel/operadores/novo' ? 'OBS' : 'DIVERGE',
      `submit vazio: url=${path(page)} alerta="${(await alertText(page)).replace(/\s+/g, ' ')}" valueMissing=[${valMissing}]`)

    // senha fraca
    const fraco = `exploratorio.fraco.${Date.now()}@pontoderesgate.local`
    await page.goto(BASE + '/painel/operadores/novo')
    await page.getByLabel('Nome').fill(`${L.TAG} fraco`)
    await page.getByLabel('E-mail').fill(fraco)
    await page.getByLabel('Senha').fill('123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await L.sleep(1200)
    rec('USR-75/senha-fraca', (await count(fraco)) === 0 ? 'OBS' : 'DIVERGE',
      `senha "123": url=${path(page)} alerta="${(await alertText(page)).replace(/\s+/g, ' ')}" criado=${await count(fraco)}`)
    await L.shot(page, 'usr75-senha-fraca')

    // e-mail duplicado (USR-69)
    await page.goto(BASE + '/painel/operadores/novo')
    await page.getByLabel('Nome').fill(`${L.TAG} duplicado`)
    await page.getByLabel('E-mail').fill(o1.email)
    await page.getByLabel('Senha').fill('senha-explo-123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await L.sleep(1200)
    const dupMsg = (await alertText(page)).replace(/\s+/g, ' ')
    rec('USR-69', 'OBS', `e-mail duplicado: url=${path(page)} alerta="${dupMsg}" formulario-mantido=${await page.getByLabel('Nome').inputValue() !== ''}`)
    await L.shot(page, 'usr69-email-duplicado')

    // só espaços / muito longo / html no nome
    const hostil = `exploratorio.hostil.${Date.now()}@pontoderesgate.local`
    await page.goto(BASE + '/painel/operadores/novo')
    await page.getByLabel('Nome').fill(`<script>alert(1)</script> ${'A'.repeat(300)}`)
    await page.getByLabel('E-mail').fill(hostil)
    await page.getByLabel('Senha').fill('senha-explo-123')
    await page.getByRole('button', { name: 'Cadastrar' }).click()
    await L.sleep(1200)
    rec('USR-75/nome-hostil', 'OBS', `nome com <script> e 300 chars: url=${path(page)} alerta="${(await alertText(page)).replace(/\s+/g, ' ').slice(0, 160)}" criado=${await count(hostil)}`)
    await context.close()
  })

  // ---------- USR-76 / USR-77 / USR-78: lista de operadores ----------
  await L.mkOperator(adm.token, 'A76-zzz')
  await L.mkOperator(adm.token, 'A76-aaa')
  await step('USR-76', async () => {
    const { context, page } = await L.newCtx(b, {}, adminSession)
    await page.goto(BASE + '/painel/operadores')
    await page.locator('tbody tr').first().waitFor({ timeout: 8000 })
    const names = await page.locator('tbody tr td:first-child').allInnerTexts()
    const sorted = [...names].sort((a, c) => a.localeCompare(c, 'pt-BR'))
    rec('USR-76/ordem', JSON.stringify(names) === JSON.stringify(sorted) ? 'OK' : 'DIVERGE', `1ª página (${names.length}): ${names.slice(0, 4).join(' | ')} ...`)
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill('admin@')
    await L.sleep(1200)
    const adminRows = await page.locator('tbody tr').count()
    const adminTxt = (await page.locator('tbody').innerText()).replace(/\s+/g, ' ')
    rec('USR-76/sem-admin', /Nenhum operador encontrado/.test(adminTxt) ? 'OK' : 'DIVERGE', `filtro e-mail "admin@": linhas=${adminRows} texto="${adminTxt.slice(0, 80)}"`)
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill('')
    await L.sleep(800)

    // USR-77 combinados
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill(o1.name)
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(novo.email)
    await L.sleep(1200)
    const vazio = (await page.locator('tbody').innerText()).replace(/\s+/g, ' ')
    rec('USR-77/sem-correspondencia', /Nenhum operador encontrado\./.test(vazio) ? 'OK' : 'DIVERGE', `nome de A e e-mail de B: "${vazio.slice(0, 90)}"`)
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill(o1.email)
    await L.sleep(1200)
    const match = await page.locator('tbody tr').count()
    rec('USR-77/combinado', match === 1 ? 'OK' : 'DIVERGE', `nome e e-mail do mesmo operador: linhas=${match}`)
    // filtro com curinga
    await page.getByRole('textbox', { name: 'Filtrar por e-mail' }).fill('')
    await page.getByRole('textbox', { name: 'Filtrar por nome' }).fill('%')
    await L.sleep(1200)
    rec('USR-77/curinga', 'OBS', `filtro nome="%": linhas=${await page.locator('tbody tr').count()} (curinga LIKE do banco tratado como texto?)`)

    // USR-78 botão novo
    await page.goto(BASE + '/painel/operadores')
    await page.getByRole('link', { name: /Novo operador/ }).click()
    await L.sleep(600)
    rec('USR-78', path(page) === '/painel/operadores/novo' ? 'OK' : 'DIVERGE', `botão "Novo operador" -> ${path(page)}`)
    await context.close()
  })

  // ---------- USR-79 / USR-80: voltar após logout; recarregar ----------
  await step('USR-79', async () => {
    const { context, page } = await L.newCtx(b)
    await L.uiLogin(page, 'admin@pontoderesgate.local', 'password')
    await page.waitForURL(/\/painel$/, { timeout: 5000 })
    await page.reload()
    await L.sleep(1000)
    rec('USR-80', path(page) === '/painel' && (await page.locator('h1').innerText()).includes('Pedidos') ? 'OK' : 'DIVERGE', `após recarregar: url=${path(page)}`)
    await page.getByRole('button', { name: 'Sair' }).click()
    await page.waitForURL(/\/login$/, { timeout: 5000 })
    await page.goBack()
    await L.sleep(1000)
    const h1 = await page.locator('h1').first().innerText().catch(() => '(sem h1)')
    const bar = await page.locator('.v-app-bar').count()
    rec('USR-79', path(page) === '/login' && bar === 0 ? 'OK' : 'DIVERGE', `voltar após sair: url=${path(page)} h1="${h1}" app-bar=${bar}`)
    // avançar
    await page.goForward().catch(() => {})
    await L.sleep(800)
    rec('USR-79/avançar', path(page) === '/login' ? 'OK' : 'DIVERGE', `avançar: url=${path(page)}`)
    await context.close()
  })

  // ---------- USR-61: operador desativado com sessão aberta ----------
  const o61 = await L.mkOperator(adm.token, 'A61-sessao')
  await step('USR-61', async () => {
    const { context, page } = await L.newCtx(b)
    await L.uiLogin(page, o61.email, o61.password)
    await page.waitForURL(/\/painel$/, { timeout: 5000 })
    const d = await api(`/api/operators/${o61.id}/deactivate`, { method: 'POST', token: adm.token })
    await page.getByRole('button', { name: 'Atualizar' }).click()
    await L.sleep(1500)
    const msg = (await alertText(page)).replace(/\s+/g, ' ')
    rec('USR-61', 'OBS', `desativado com sessão aberta (API ${d.status}): após Atualizar url=${path(page)} alerta="${msg}" http=[${page.http.join(', ')}]`)
    await L.shot(page, 'usr61-desativado-sessao-aberta')
    await context.close()
  })

  // ---------- extras: token adulterado e papel adulterado no localStorage ----------
  await step('EXTRA-token', async () => {
    const { context, page } = await L.newCtx(b, {}, { token: 'token-invalido-xyz', user: adm.user })
    await page.goto(BASE + '/painel')
    await L.sleep(1500)
    rec('EXTRA/token-adulterado', 'OBS', `token inválido no localStorage: url=${path(page)} alerta="${(await alertText(page)).replace(/\s+/g, ' ')}" http=[${page.http.join(', ')}]`)
    await L.shot(page, 'extra-token-adulterado')
    await context.close()
  })
  const o2 = await L.mkOperator(adm.token, 'A-papel')
  await step('EXTRA-papel', async () => {
    const lg = await L.login(o2.email, o2.password)
    const fake = { ...lg.user, role: 'admin_master' }
    const { context, page } = await L.newCtx(b, {}, { token: lg.token, user: fake })
    await page.goto(BASE + '/painel/operadores')
    await L.sleep(1500)
    rec('EXTRA/papel-adulterado', 'OBS', `operador com role forjado no localStorage: url=${path(page)} alerta="${(await alertText(page)).replace(/\s+/g, ' ')}" http=[${page.http.join(', ')}] linhas=${await page.locator('tbody tr').count()}`)
    await L.shot(page, 'extra-papel-adulterado')
    await context.close()
  })

  // ---------- título da aba ----------
  await step('EXTRA-titulo', async () => {
    const { context, page } = await L.newCtx(b)
    const t = []
    for (const p of ['/', '/login']) { await page.goto(BASE + p); t.push(`${p}="${await page.title()}"`) }
    rec('EXTRA/titulo-da-aba', 'OBS', t.join(' '))
    await context.close()
  })

  await b.close()
  console.log('FIM charter A')
})().catch((e) => { console.error('ERRO GERAL', e); process.exit(1) })
