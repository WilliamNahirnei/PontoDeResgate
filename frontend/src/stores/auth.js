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
      .catch(() => {
        // Sem confirmação, o papel guardado não vale: nenhuma tela de admin master abre.
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

  return { token, user, isAuthenticated, isAdminMaster, verifySession, login, logout }
})
