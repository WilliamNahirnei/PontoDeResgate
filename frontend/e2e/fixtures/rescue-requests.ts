import type { APIRequestContext } from '@playwright/test'
import { ADMIN_MASTER_CREDENTIALS } from './auth'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8180'

type RescueRequestOverrides = Record<string, unknown>

type RescueRequest = {
  id: number
  requester_name: string
  status: string
  latitude: number
  longitude: number
}

let cachedAdminToken: string | null = null

async function getAdminToken(request: APIRequestContext): Promise<string> {
  if (cachedAdminToken) {
    return cachedAdminToken
  }

  const response = await request.post(`${API_BASE_URL}/api/login`, { data: ADMIN_MASTER_CREDENTIALS })
  const body = await response.json()
  cachedAdminToken = body.token as string

  return cachedAdminToken
}

// Cria um pedido de resgate via chamada HTTP direta ao backend (rota
// pública, sem autenticação) e resolve o registro criado por meio da
// listagem autenticada — a rota pública de criação devolve só uma mensagem
// de confirmação, nunca o recurso (RES-17: quem solicita não tem nenhum
// identificador do próprio pedido).
export async function createRescueRequest(
  request: APIRequestContext,
  overrides: RescueRequestOverrides = {},
): Promise<RescueRequest> {
  const requesterName =
    (overrides.requester_name as string | undefined) ??
    `E2E pedido ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await request.post(`${API_BASE_URL}/api/rescue-requests`, {
    data: {
      latitude: -23.5505,
      longitude: -46.6333,
      ...overrides,
      requester_name: requesterName,
    },
  })

  const token = await getAdminToken(request)
  const listResponse = await request.get(`${API_BASE_URL}/api/rescue-requests`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listBody = await listResponse.json()
  const created = (listBody.data as RescueRequest[]).find((item) => item.requester_name === requesterName)

  if (!created) {
    throw new Error(
      `createRescueRequest: não encontrou na listagem o pedido recém-criado (requester_name="${requesterName}").`,
    )
  }

  return created
}
