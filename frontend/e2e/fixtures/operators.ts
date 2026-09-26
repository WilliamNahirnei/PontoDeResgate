import type { APIRequestContext } from '@playwright/test'
import { ADMIN_MASTER_CREDENTIALS } from './auth'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

export type Operator = {
  id: number
  name: string
  email: string
  password: string
  token: string
  user: unknown
}

export async function loginViaApi(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/login`, { data: { email, password } })
  const body = await response.json()

  return { token: body.token as string, user: body.user }
}

export async function adminMasterToken(request: APIRequestContext): Promise<string> {
  const { token } = await loginViaApi(request, ADMIN_MASTER_CREDENTIALS.email, ADMIN_MASTER_CREDENTIALS.password)

  return token
}

// Cadastra um operador comum via API (autenticado como admin master) e já faz
// o login dele, sem injetar sessão em nenhuma página: serve aos testes que
// precisam de um segundo operador agindo por API ou entrando pela tela de login.
export async function createOperator(
  request: APIRequestContext,
  overrides: Partial<Pick<Operator, 'name' | 'email' | 'password'>> = {},
): Promise<Operator> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const data = {
    name: overrides.name ?? `Operador E2E ${unique}`,
    email: overrides.email ?? `e2e.operador.${unique}@pontoderesgate.local`,
    password: overrides.password ?? 'senha-e2e-123',
  }

  const adminToken = await adminMasterToken(request)
  const created = await request.post(`${API_BASE_URL}/api/operators`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data,
  })
  const createdBody = await created.json()
  const { token, user } = await loginViaApi(request, data.email, data.password)

  return { id: createdBody.id as number, ...data, token, user }
}
