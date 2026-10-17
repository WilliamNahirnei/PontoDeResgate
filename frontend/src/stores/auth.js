import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { AUTH_TOKEN_STORAGE_KEY } from '@/services/api'

const USER_STORAGE_KEY = 'pontoderesgate.user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY))
  const user = ref(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? 'null'))

  const isAuthenticated = computed(() => Boolean(token.value))

  // O usuário guardado no navegador pode ser editado por quem o usa; o papel
  // só vale depois de confirmado pelo servidor (no login ou em verifySession).
  const sessionVerified = ref(false)
  const isAdminMaster = computed(() => sessionVerified.value && user.value?.role === 'admin_master')
  let verification = null

  // Aviso mostrado na tela de login depois que o servidor recusa a autenticação.
  const sessionExpired = ref(false)

  // Apaga a sessão guardada (no store e no navegador). Só avisa que a sessão
  // expirou se havia uma sessão a encerrar.
  function endSession() {
    if (token.value) {
      sessionExpired.value = true
    }

    token.value = null
    user.value = null
    sessionVerified.value = false
    persist()
  }

  function dismissSessionExpired() {
    sessionExpired.value = false
  }

  function verifySession() {
    if (!token.value || sessionVerified.value) {
      return Promise.resolve()
    }

    verification ??= api
      .get('/api/me')
      .then((response) => {
        user.value = response.data.data
        sessionVerified.value = true
        persist()
      })
      .catch((error) => {
        // Sem confirmação, o papel guardado não vale: nenhuma tela de admin master abre.
        if (error.response?.status === 401) {
          endSession()
        }
      })
      .finally(() => {
        verification = null
      })

    return verification
  }

  function persist() {
    if (token.value) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token.value)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user.value))
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  }

  async function login(email, password) {
    const response = await api.post('/api/login', { email, password })
    token.value = response.data.token
    user.value = response.data.user
    sessionVerified.value = true
    sessionExpired.value = false
    persist()
  }

  async function logout() {
    try {
      await api.post('/api/logout')
    } finally {
      token.value = null
      user.value = null
      sessionVerified.value = false
      persist()
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdminMaster,
    sessionExpired,
    verifySession,
    endSession,
    dismissSessionExpired,
    login,
    logout,
  }
})
