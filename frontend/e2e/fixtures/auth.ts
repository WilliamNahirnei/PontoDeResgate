import { test as base } from '@playwright/test'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const TOKEN_STORAGE_KEY = 'pontoderesgate.token'
const USER_STORAGE_KEY = 'pontoderesgate.user'

export const ADMIN_MASTER_CREDENTIALS = {
  email: 'admin@pontoderesgate.local',
  password: 'password',
}

type OperatorCredentials = {
  name: string
  email: string
  password: string
}

type AuthFixtures = {
  loginAsAdminMaster: () => Promise<string>
  loginAsNewOperator: () => Promise<OperatorCredentials>
}

export async function injectSession(page, token: string, user: unknown) {
  await page.addInitScript(
    ([tokenKey, userKey, injectedToken, injectedUser]) => {
      window.localStorage.setItem(tokenKey, injectedToken)
      window.localStorage.setItem(userKey, JSON.stringify(injectedUser))
    },
    [TOKEN_STORAGE_KEY, USER_STORAGE_KEY, token, user],
  )
}

export const test = base.extend<AuthFixtures>({
  loginAsAdminMaster: async ({ page, request }, use) => {
    await use(async () => {
      const response = await request.post(`${API_BASE_URL}/api/login`, {
        data: ADMIN_MASTER_CREDENTIALS,
      })
      const body = await response.json()

      await injectSession(page, body.token, body.user)

      return body.token as string
    })
  },

  // Cadastra um operador comum novo (via API, autenticado como admin master)
  // e injeta a sessão desse operador na página — usado pelos testes que
  // precisam verificar restrições de papel (não admin master).
  loginAsNewOperator: async ({ page, request }, use) => {
    await use(async () => {
      const adminLogin = await request.post(`${API_BASE_URL}/api/login`, {
        data: ADMIN_MASTER_CREDENTIALS,
      })
      const adminBody = await adminLogin.json()

      const credentials: OperatorCredentials = {
        name: `Operador E2E ${Date.now()}`,
        email: `e2e.operador.${Date.now()}@pontoderesgate.local`,
        password: 'senha-e2e-123',
      }

      await request.post(`${API_BASE_URL}/api/operators`, {
        headers: { Authorization: `Bearer ${adminBody.token}` },
        data: credentials,
      })

      const operatorLogin = await request.post(`${API_BASE_URL}/api/login`, {
        data: { email: credentials.email, password: credentials.password },
      })
      const operatorBody = await operatorLogin.json()

      await injectSession(page, operatorBody.token, operatorBody.user)

      return credentials
    })
  },
})

export { expect } from '@playwright/test'
