<script setup>
import { onMounted, ref } from 'vue'
import api from '@/services/api'
import RescueRequestsMap from '@/components/RescueRequestsMap.vue'
import RescueRequestsList from '@/components/RescueRequestsList.vue'
import CancelRescueRequestDialog from '@/components/CancelRescueRequestDialog.vue'

const rescueRequests = ref([])
const selectedId = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const cancelDialogRequest = ref(null)
const shareFeedback = ref(false)

async function fetchRescueRequests() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/rescue-requests')
    rescueRequests.value = response.data.data
  } catch {
    errorMessage.value = 'Não foi possível carregar os pedidos.'
  } finally {
    loading.value = false
  }
}

function handleSelect(id) {
  selectedId.value = id
}

function updateLocalRequest(updated) {
  const index = rescueRequests.value.findIndex((item) => item.id === updated.id)
  if (index !== -1) {
    rescueRequests.value[index] = updated
  }
}

async function handleAssume(rescueRequest) {
  const response = await api.post(`/api/rescue-requests/${rescueRequest.id}/assume`)
  updateLocalRequest(response.data.data)
}

async function handleComplete(rescueRequest) {
  const response = await api.post(`/api/rescue-requests/${rescueRequest.id}/complete`)
  updateLocalRequest(response.data.data)
}

function openCancelDialog(rescueRequest) {
  cancelDialogRequest.value = rescueRequest
}

async function handleCancelConfirm(reason) {
  const rescueRequest = cancelDialogRequest.value
  const response = await api.post(`/api/rescue-requests/${rescueRequest.id}/cancel`, {
    cancellation_reason: reason,
  })
  updateLocalRequest(response.data.data)
  cancelDialogRequest.value = null
}

function shareLocation(rescueRequest) {
  const url = `https://www.google.com/maps?q=${rescueRequest.latitude},${rescueRequest.longitude}`

  if (navigator.share) {
    navigator.share({ title: 'Localização do pedido de resgate', url }).catch(() => {})
    return
  }

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        shareFeedback.value = true
      })
      .catch(() => {})
  }
}

onMounted(fetchRescueRequests)
</script>

<template>
  <div class="panel-page">
    <div class="d-flex align-center justify-space-between px-4 py-3">
      <h1 class="text-h6">Pedidos de resgate</h1>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="fetchRescueRequests">
        Atualizar
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mx-4 mb-2">{{ errorMessage }}</v-alert>

    <div class="panel-content">
      <RescueRequestsMap
        class="panel-map"
        :rescue-requests="rescueRequests"
        :selected-id="selectedId"
        @select="handleSelect"
      />
      <RescueRequestsList
        class="panel-list"
        :rescue-requests="rescueRequests"
        :selected-id="selectedId"
        @select="handleSelect"
        @assume="handleAssume"
        @complete="handleComplete"
        @cancel="openCancelDialog"
        @share="shareLocation"
      />
    </div>

    <CancelRescueRequestDialog
      :model-value="Boolean(cancelDialogRequest)"
      @update:model-value="(value) => { if (!value) cancelDialogRequest = null }"
      @confirm="handleCancelConfirm"
    />

    <v-snackbar v-model="shareFeedback" timeout="2500">
      Localização copiada para a área de transferência.
    </v-snackbar>
  </div>
</template>

<style scoped>
.panel-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px));
  height: calc(100dvh - var(--v-layout-top, 64px));
}

.panel-content {
  flex: 1 1 auto;
  display: flex;
  gap: 16px;
  min-height: 0;
  padding: 0 16px 16px;
}

.panel-map {
  flex: 1 1 60%;
  min-width: 0;
}

.panel-list {
  flex: 1 1 40%;
  min-width: 280px;
  max-width: 480px;
}

@media (max-width: 960px) {
  .panel-content {
    flex-direction: column;
  }

  .panel-map,
  .panel-list {
    flex: 1 1 50%;
    max-width: none;
  }
}
</style>
