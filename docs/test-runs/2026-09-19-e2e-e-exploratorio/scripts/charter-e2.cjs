const L = require('/work/lib.cjs')
const flat = (s) => String(s).replace(/\s+/g, ' ').trim()
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin()
  const pages = []
  let last = 1
  for (let p = 1; p <= 12; p++) {
    const r = await L.api(`/api/rescue-status-logs?page=${p}&per_page=15`, { token: adm.token })
    if (p === 1) last = r.json?.meta?.last_page ?? 12
    pages.push(`p${p}=${r.status}`)
    if (p >= last) break
  }
  console.log(`RESULT|RES-119/api-por-pagina|OBS|${pages.join(' ')} (última página=${last})`)
  const { page } = await L.newCtx(b, {}, { token: adm.token, user: adm.user })
  await page.goto(L.BASE + '/painel/logs'); await L.sleep(1500)
  let bad = null
  for (let i = 1; i <= last; i++) {
    const alert = flat(await page.locator('.v-alert').allInnerTexts().then((a) => a.join(' | ')))
    const rows = await page.locator('tbody tr').count()
    const txt = flat(await page.locator('tbody').innerText()).slice(0, 60)
    if (page.http.some((h) => h.startsWith('500')) && !bad) {
      bad = i
      console.log(`RESULT|RES-119/ui|OBS|na página ${i} da tela de logs: alerta="${alert}" linhas=${rows} tabela="${txt}" http=[${page.http.join(', ')}]`)
      await L.shot(page, 'res119-logs-pagina-quebrada')
      // dá para voltar à página anterior?
      const prev = page.getByRole('button', { name: 'Previous page' })
      console.log(`RESULT|RES-119/ui-navegacao|OBS|botão "Previous page" habilitado=${await prev.isEnabled().catch(() => 'n/a')}`)
      break
    }
    const next = page.getByRole('button', { name: 'Next page' })
    if (!(await next.isEnabled())) break
    await next.click(); await L.sleep(1500)
  }
  if (!bad) console.log('RESULT|RES-119/ui|OBS|nenhuma página da tela de logs falhou')
  await b.close()
})()
