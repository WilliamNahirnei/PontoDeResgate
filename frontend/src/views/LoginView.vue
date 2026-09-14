<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''

  try {
    await authStore.login(email.value, password.value)
    router.push({ name: 'panel' })
  } catch {
    errorMessage.value = 'E-mail ou senha inválidos.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh; max-width: 420px">
    <v-card width="100%" class="pa-4">
      <v-card-title>Entrar</v-card-title>
      <v-card-subtitle class="mb-4">Acesso para operadores e voluntários</v-card-subtitle>

      <v-form @submit.prevent="handleSubmit">
        <v-text-field v-model="email" label="E-mail" type="email" class="mb-2" required />
        <v-text-field v-model="password" label="Senha" type="password" class="mb-4" required />

        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-btn type="submit" color="primary" block :loading="loading">Entrar</v-btn>
      </v-form>

      <div class="text-center mt-4">
        <RouterLink to="/" class="text-caption">Voltar para o pedido de socorro</RouterLink>
      </div>
    </v-card>
  </v-container>
</template>
