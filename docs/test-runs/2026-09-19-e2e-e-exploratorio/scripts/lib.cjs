// Base dos scripts exploratórios descartáveis (fora do projeto). Dados criados levam o prefixo TAG.
const { chromium } = require('playwright-core')
const fs = require('fs')

const API = 'http://localhost:8180'
const BASE = 'http://localhost:5183'
const TAG = 'EXPLORATORIO 2026-09-19'
const SHOTS = '/work/shots'
fs.mkdirSync(SHOTS, { recursive: true })

async function api(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json }
}

async function login(email, password) {
  const r = await api('/api/login', { method: 'POST', body: { email, password } })
  return { token: r.json?.token, user: r.json?.user, status: r.status }
}
const adminLogin = () => login('admin@pontoderesgate.local', 'password')

async function mkOperator(adminToken, suffix) {
  const email = `exploratorio.${suffix}.${Date.now()}@pontoderesgate.local`.toLowerCase()
  const password = 'senha-explo-123'
  const name = `${TAG} ${suffix}`
  const r = await api('/api/operators', { method: 'POST', token: adminToken, body: { name, email, password } })
  return { id: r.json?.id, email, password, name, status: r.status }
}

// A rota pública não devolve o id: localiza o pedido pelo nome na listagem autenticada.
async function mkRequest(adminToken, fields = {}) {
  const requester_name = fields.requester_name ?? `${TAG} pedido ${Math.random().toString(36).slice(2, 7)}`
  const r = await api('/api/rescue-requests', {
    method: 'POST',
    body: { latitude: -23.5505, longitude: -46.6333, ...fields, requester_name },
  })
  const list = await api('/api/rescue-requests', { token: adminToken })
  const found = (list.json?.data ?? []).find((x) => x.requester_name === requester_name)
  return { id: found?.id, name: requester_name, postStatus: r.status, item: found }
}

const results = []
function rec(id, verdict, note) {
  results.push({ id, verdict, note })
  console.log(`RESULT|${id}|${verdict}|${note}`)
}

async function launch() {
  return chromium.launch({ headless: true })
}

// Contexto com coleta de erros de console e respostas HTTP >= 400.
async function newCtx(browser, opts = {}, session = null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR', ...opts })
  if (session) {
    await context.addInitScript(([t, u]) => {
      localStorage.setItem('pontoderesgate.token', t)
      localStorage.setItem('pontoderesgate.user', JSON.stringify(u))
    }, [session.token, session.user])
  }
  const page = await context.newPage()
  page.errors = []
  page.http = []
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + String(e).slice(0, 200)))
  page.on('response', (r) => { if (r.status() >= 400) page.http.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`) })
  return { context, page }
}

async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`
  await page.screenshot({ path: p, fullPage: false }).catch(() => {})
  return p
}

async function uiLogin(page, email, password) {
  await page.goto(BASE + '/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

module.exports = { API, BASE, TAG, SHOTS, api, login, adminLogin, mkOperator, mkRequest, rec, results, launch, newCtx, shot, uiLogin, sleep }
