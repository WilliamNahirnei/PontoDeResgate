const L = require('/work/lib.cjs')
const { BASE, api, TAG } = L
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin(); const stamp = Date.now()
  const op = await L.mkOperator(adm.token, `D2-op-${stamp}`)
  const c = await L.newCtx(b); await L.uiLogin(c.page, op.email, op.password)
  await c.page.waitForURL(/\/painel$/); await c.page.locator('.rescue-requests-list .v-card').first().waitFor(); await L.sleep(800)
  const logsOf = async (id) => (await api('/api/rescue-status-logs?per_page=200', { token: adm.token })).json.data.filter((x) => x.rescue_request.id === id).map((x) => `${x.previous_status}->${x.new_status}`)
  for (let i = 1; i <= 3; i++) {
    const r = await L.mkRequest(adm.token, { requester_name: `${TAG} D2-dbl ${i} ${stamp}`, latitude: -10 + i / 100, longitude: -40 })
    await c.page.getByRole('button', { name: 'Atualizar' }).click(); await L.sleep(1200)
    const card = c.page.locator('.rescue-requests-list .v-card', { hasText: r.name })
    await card.getByRole('button', { name: 'Assumir' }).dblclick(); await L.sleep(2000)
    console.log(`RESULT|D-duplo-clique/assumir-${i}|OBS|logs=${JSON.stringify(await logsOf(r.id))} http=[${c.page.http.join(', ')}]`)
    c.page.http.length = 0
  }
  // duplo clique em Concluir
  const r = await L.mkRequest(adm.token, { requester_name: `${TAG} D2-dbl concluir ${stamp}`, latitude: -10.5, longitude: -40 })
  await api(`/api/rescue-requests/${r.id}/assume`, { method: 'POST', token: adm.token })
  await c.page.getByRole('button', { name: 'Atualizar' }).click(); await L.sleep(1200)
  await c.page.locator('.rescue-requests-list .v-card', { hasText: r.name }).getByRole('button', { name: 'Concluir' }).dblclick(); await L.sleep(2000)
  console.log(`RESULT|D-duplo-clique/concluir|OBS|logs=${JSON.stringify(await logsOf(r.id))} http=[${c.page.http.join(', ')}]`)
  await b.close()
})()
