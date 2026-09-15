<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''

  try {
    await api.post('/api/operators', {
      name: name.value,
      email: email.value,
      password: password.value,
    })
    router.push({ name: 'operators-list' })
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? 'Não foi possível cadastrar o operador.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="d-flex align-center justify-center" style="min-height: calc(100vh - 64px); max-width: 480px">
    <v-card width="100%" class="pa-4">
      <v-card-title>Novo operador</v-card-title>
      <v-card-subtitle class="mb-4">Cadastro de operador/voluntário</v-card-subtitle>

      <v-form @submit.prevent="handleSubmit">
        <v-text-field v-model="name" label="Nome" class="mb-2" required />
        <v-text-field v-model="email" label="E-mail" type="email" class="mb-2" required />
        <v-text-field v-model="password" label="Senha" type="password" class="mb-4" required />

        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <div class="d-flex ga-2">
          <v-btn variant="text" :to="{ name: 'operators-list' }">Cancelar</v-btn>
          <v-btn type="submit" color="primary" :loading="loading">Cadastrar</v-btn>
        </div>
      </v-form>
    </v-card>
  </v-container>
</template>
