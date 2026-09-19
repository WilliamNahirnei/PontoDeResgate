const L = require('/work/lib.cjs')
;(async () => {
  const b = await L.launch(); const adm = await L.adminLogin()
  const { page } = await L.newCtx(b, {}, { token: adm.token, user: adm.user })
  await page.goto(L.BASE + '/painel'); await page.locator('.rescue-requests-list .v-card').first().waitFor(); await L.sleep(1200)
  const total = await page.locator('.rescue-requests-list .v-card').count()
  await page.getByRole('button', { name: 'Filtrar por quantidade' }).click(); await L.sleep(600)
  const info = await page.evaluate(() => ({
    overlays: [...document.querySelectorAll('.v-overlay--active')].map((o) => o.className.split(' ').filter((c) => /v-menu|v-overlay--/.test(c)).join('.')),
    limpar: [...document.querySelectorAll('button')].filter((b) => /Limpar filtros/.test(b.innerText)).map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), inOverlay: !!b.closest('.v-overlay') } }),
    numeric: document.querySelectorAll('input[type=number]').length,
    labels: [...document.querySelectorAll('label')].filter((l) => /Mín\./.test(l.innerText)).length,
  }))
  console.log('DOM com o menu aberto:', JSON.stringify(info), '| cards sem filtro:', total)
  await page.getByLabel('Mín. animais').fill('3'); await L.sleep(1300)
  const filtrado = await page.locator('.rescue-requests-list .v-card').count()
  console.log('cards com Mín. animais=3:', filtrado)
  for (const idx of [0, 1]) {
    const btn = page.getByRole('button', { name: 'Limpar filtros' }).nth(idx)
    const box = await btn.boundingBox()
    // reabre o menu se fechou
    if ((await page.getByLabel('Mín. animais').count()) === 0) { await page.getByRole('button', { name: 'Filtrar por quantidade' }).click(); await L.sleep(500) }
    await page.getByLabel('Mín. animais').fill('3'); await L.sleep(1300)
    const antes = await page.locator('.rescue-requests-list .v-card').count()
    await btn.click(); await L.sleep(1600)
    const depois = await page.locator('.rescue-requests-list .v-card').count()
    console.log(`clique no botão #${idx} (x=${box?.x},y=${box?.y}): cards antes=${antes} depois=${depois} menu-aberto=${await page.getByLabel('Mín. animais').count() > 0}`)
  }
  await L.shot(page, 'debug-limpar')
  await b.close()
})()
