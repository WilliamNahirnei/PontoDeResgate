const L = require('/work/lib.cjs')
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin()
  const { page } = await L.newCtx(b, {}, { token: adm.token, user: adm.user })
  await page.goto(L.BASE + '/painel/operadores')
  await page.waitForFunction(() => { const r = document.querySelector('tbody tr td:first-child'); return r && !/Loading/i.test(r.innerText) }, null, { timeout: 8000 })
  const names = await page.locator('tbody tr td:first-child').allInnerTexts()
  const sorted = [...names].sort((a, c) => a.toLowerCase().localeCompare(c.toLowerCase()))
  const api = await L.api('/api/operators?per_page=100', { token: adm.token })
  const roles = [...new Set((api.json?.data ?? []).map((u) => u.role))]
  L.rec('USR-76/ordem', JSON.stringify(names) === JSON.stringify(sorted) ? 'OK' : 'DIVERGE', `1ª página (${names.length}): ${names.join(' | ')} ; papéis na API=${roles}`)
  await b.close()
})()
