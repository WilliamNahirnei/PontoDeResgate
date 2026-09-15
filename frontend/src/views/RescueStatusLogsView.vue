<script setup>
import { ref } from 'vue'
import api from '@/services/api'

const STATUS_LABELS = {
  pendente: 'Pendente',
  em_resgate: 'Em resgate',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const STATUS_COLORS = {
  pendente: 'error',
  em_resgate: 'primary',
  concluido: 'success',
  cancelado: 'grey',
}

const logs = ref([])
const totalLogs = ref(0)
const loading = ref(false)
const errorMessage = ref('')

const headers = [
  { title: 'Data/hora', key: 'created_at' },
  { title: 'Pedido', key: 'rescue_request', sortable: false },
  { title: 'Operador', key: 'operator', sortable: false },
  { title: 'Status anterior', key: 'previous_status', sortable: false },
  { title: 'Novo status', key: 'new_status', sortable: false },
]

async function fetchLogs({ page, itemsPerPage }) {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/rescue-status-logs', {
      params: { page, per_page: itemsPerPage },
    })
    logs.value = response.data.data
    totalLogs.value = response.data.meta.total
  } catch {
    errorMessage.value = 'Não foi possível carregar os logs.'
  } finally {
    loading.value = false
  }
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR')
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-h6 mb-4">Logs de operações</h1>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-data-table-server
      :headers="headers"
      :items="logs"
      :items-length="totalLogs"
      :items-per-page="15"
      :loading="loading"
      items-per-page-text="Logs por página"
      no-data-text="Nenhum log encontrado."
      @update:options="fetchLogs"
    >
      <template #[`item.created_at`]="{ item }">
        {{ formatDateTime(item.created_at) }}
      </template>

      <template #[`item.rescue_request`]="{ item }">
        {{ item.rescue_request.requester_name || 'Pedido sem nome informado' }}
      </template>

      <template #[`item.operator`]="{ item }">
        {{ item.operator.name }}
      </template>

      <template #[`item.previous_status`]="{ item }">
        <v-chip :color="STATUS_COLORS[item.previous_status]" size="small" variant="tonal">
          {{ STATUS_LABELS[item.previous_status] }}
        </v-chip>
      </template>

      <template #[`item.new_status`]="{ item }">
        <v-chip :color="STATUS_COLORS[item.new_status]" size="small" variant="tonal">
          {{ STATUS_LABELS[item.new_status] }}
        </v-chip>
      </template>
    </v-data-table-server>
  </div>
</template>
