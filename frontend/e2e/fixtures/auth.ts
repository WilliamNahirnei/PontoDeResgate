import { test as base } from '@playwright/test'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'
const TOKEN_STORAGE_KEY = 'pontoderesgate.token'
const USER_STORAGE_KEY = 'pontoderesgate.user'

export const ADMIN_MASTER_CREDENTIALS = {
  email: 'admin@pontoderesgate.local',
  password: 'password',
}

type AuthFixtures = {
  loginAsAdminMaster: () => Promise<void>
}

export const test = base.extend<AuthFixtures>({
  loginAsAdminMaster: async ({ page, request }, use) => {
    await use(async () => {
      const response = await request.post(`${API_BASE_URL}/api/login`, {
        data: ADMIN_MASTER_CREDENTIALS,
      })
      const body = await response.json()

      await page.addInitScript(
        ([tokenKey, userKey, token, user]) => {
          window.localStorage.setItem(tokenKey, token)
          window.localStorage.setItem(userKey, JSON.stringify(user))
        },
        [TOKEN_STORAGE_KEY, USER_STORAGE_KEY, body.token, body.user],
      )
    })
  },
})

export { expect } from '@playwright/test'
