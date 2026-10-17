import axios from 'axios'

export const AUTH_TOKEN_STORAGE_KEY = 'pontoderesgate.token'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Chamadas em que um 401 não significa sessão recusada: no login é credencial
// errada, e no logout a sessão já está sendo encerrada.
const UNAUTHORIZED_IGNORED_URLS = ['/api/login', '/api/logout']

let unauthorizedHandler = null

export function onUnauthorized(handler) {
  unauthorizedHandler = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ''

    if (error.response?.status === 401 && !UNAUTHORIZED_IGNORED_URLS.some((ignored) => url.endsWith(ignored))) {
      unauthorizedHandler?.(error)
    }

    return Promise.reject(error)
  },
)

export default api
