import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { AUTH_TOKEN_STORAGE_KEY } from '@/services/api'

const USER_STORAGE_KEY = 'pontoderesgate.user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY))
  const user = ref(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? 'null'))

  const isAuthenticated = computed(() => Boolean(token.value))

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
    persist()
  }

  async function logout() {
    try {
      await api.post('/api/logout')
    } finally {
      token.value = null
      user.value = null
      persist()
    }
  }

  return { token, user, isAuthenticated, login, logout }
})
