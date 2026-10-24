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
// Entrada cujo motivo/observação está aberto na janela (REQUISITOS.md §4.4).
const observationLog = ref(null)

// O texto gravado com a mudança: motivo no cancelamento, observação na conclusão.
const OBSERVATION_TITLES = {
  cancelado: 'Motivo do cancelamento',
  concluido: 'Observação da conclusão',
}
const OBSERVATION_BUTTON_LABELS = {
  cancelado: 'Ver motivo do cancelamento',
  concluido: 'Ver observação',
}

const headers = [
  { title: 'Data/hora', key: 'created_at' },
  { title: 'Pedido', key: 'rescue_request', sortable: false },
  { title: 'Operador', key: 'operator', sortable: false },
  { title: 'Status anterior', key: 'previous_status', sortable: false },
  { title: 'Novo status', key: 'new_status', sortable: false },
  { title: 'Observação', key: 'observation', sortable: false, align: 'center' },
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

      <!-- O texto só aparece na janela; a linha mostra apenas o ícone, e só
           quando existe motivo ou observação. -->
      <template #[`item.observation`]="{ item }">
        <v-btn
          v-if="item.observation"
          icon="mdi-text-box-outline"
          variant="text"
          size="small"
          :aria-label="OBSERVATION_BUTTON_LABELS[item.new_status]"
          @click="observationLog = item"
        />
      </template>
    </v-data-table-server>

    <v-dialog
      :model-value="Boolean(observationLog)"
      max-width="520"
      @update:model-value="(value) => { if (!value) observationLog = null }"
    >
      <v-card v-if="observationLog">
        <v-card-title>{{ OBSERVATION_TITLES[observationLog.new_status] }}</v-card-title>
        <v-card-text>
          <p class="observation-text mb-4">{{ observationLog.observation }}</p>
          <div class="text-body-2">
            <div><strong>Pedido:</strong> {{ observationLog.rescue_request.requester_name || 'Pedido sem nome informado' }}</div>
            <div><strong>Operador:</strong> {{ observationLog.operator.name }}</div>
            <div><strong>Data/hora:</strong> {{ formatDateTime(observationLog.created_at) }}</div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="observationLog = null">Fechar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.observation-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
