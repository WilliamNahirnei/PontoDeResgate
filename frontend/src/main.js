import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { onUnauthorized } from './services/api'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

// Autenticação recusada na área autenticada: a sessão é apagada e a pessoa vai
// ao login. A tela pública não exige login e não é afetada.
onUnauthorized(() => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated || !router.currentRoute.value.meta.requiresAuth) {
    return
  }

  authStore.endSession()
  router.push({ name: 'login' })
})

app.mount('#app')
