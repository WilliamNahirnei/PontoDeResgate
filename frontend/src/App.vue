<script setup>
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// A barra do painel só pode aparecer na área do operador: a tela pública não
// deve citar nem referenciar a área do operador em nenhuma circunstância,
// nem mesmo quando há uma sessão de operador salva no navegador.
const showPanelBar = computed(() => route.meta.requiresAuth && authStore.isAuthenticated)

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <v-app>
    <v-app-bar v-if="showPanelBar" color="primary" density="comfortable">
      <v-app-bar-title>Ponto de Resgate — Painel</v-app-bar-title>
      <template #append>
        <span class="text-body-2 mr-4">{{ authStore.user?.name }}</span>
        <v-btn variant="text" @click="handleLogout">Sair</v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>
