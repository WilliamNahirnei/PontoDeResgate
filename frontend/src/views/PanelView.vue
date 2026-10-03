<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/services/api'
import RescueRequestsMap from '@/components/RescueRequestsMap.vue'
import RescueRequestsList from '@/components/RescueRequestsList.vue'
import CancelRescueRequestDialog from '@/components/CancelRescueRequestDialog.vue'

const STATUS_OPTIONS = [
  { title: 'Todos os status', value: 'all' },
  { title: 'Pendente', value: 'pendente' },
  { title: 'Em resgate', value: 'em_resgate' },
  { title: 'Concluído', value: 'concluido' },
  { title: 'Cancelado', value: 'cancelado' },
]

const QUANTITY_FIELDS = [
  { field: 'total_people', label: 'Total de pessoas' },
  { field: 'men_count', label: 'Homens' },
  { field: 'women_count', label: 'Mulheres' },
  { field: 'children_count', label: 'Crianças' },
  { field: 'elderly_count', label: 'Idosos' },
  { field: 'animals_count', label: 'Animais' },
]

const SORT_FIELD_OPTIONS = [
  { title: 'Data/hora do pedido', value: 'created_at' },
  ...QUANTITY_FIELDS.map(({ field, label }) => ({ title: label, value: field })),
]

const rescueRequests = ref([])
const selectedId = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const cancelDialogRequest = ref(null)
const shareFeedback = ref(false)
// Link mostrado para cópia manual quando a cópia automática falha.
const manualShareUrl = ref('')
const actionErrorMessage = ref('')
// Ações de status em andamento, como chaves "<id do pedido>:<ação>".
const actionsInProgress = ref([])
const cancelInProgress = computed(
  () => Boolean(cancelDialogRequest.value) && actionsInProgress.value.includes(actionKey(cancelDialogRequest.value.id, 'cancel')),
)

const DEFAULT_ACTION_ERROR_MESSAGE = 'Não foi possível alterar o pedido. Tente novamente.'

const statusFilter = ref('all')
const minQuantities = ref(Object.fromEntries(QUANTITY_FIELDS.map(({ field }) => [field, ''])))
const sortField = ref('created_at')
const sortDirection = ref('desc')

function clearQuantityFilters() {
  for (const { field } of QUANTITY_FIELDS) {
    minQuantities.value[field] = ''
  }
}

// Os filtros e a ordenação são resolvidos no backend (via query params), em
// vez de carregar todos os pedidos e processar no navegador — evita
// sobrecarregar a memória do navegador e o tamanho da resposta da API.
function buildQueryParams() {
  const params = {
    sort_by: sortField.value,
    sort_direction: sortDirection.value,
  }

  if (statusFilter.value !== 'all') {
    params.status = statusFilter.value
  }

  for (const { field } of QUANTITY_FIELDS) {
    const minValue = minQuantities.value[field]
    if (minValue !== '' && minValue !== null) {
      params[`min_${field}`] = minValue
    }
  }

  return params
}

async function fetchRescueRequests() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/rescue-requests', { params: buildQueryParams() })
    rescueRequests.value = response.data.data
  } catch {
    errorMessage.value = 'Não foi possível carregar os pedidos.'
  } finally {
    loading.value = false
  }
}

let quantityFilterTimeout = null

watch(statusFilter, fetchRescueRequests)
watch([sortField, sortDirection], fetchRescueRequests)
watch(
  minQuantities,
  () => {
    clearTimeout(quantityFilterTimeout)
    quantityFilterTimeout = setTimeout(fetchRescueRequests, 400)
  },
  { deep: true },
)

function handleSelect(id) {
  selectedId.value = id
}

function actionKey(rescueRequestId, action) {
  return `${rescueRequestId}:${action}`
}

// Uma ação recusada porque outro operador alterou o pedido (409) mostra a
// mensagem da API, fecha o diálogo aberto e recarrega a lista, para o card
// passar a mostrar o status atual. Outras falhas mantêm o diálogo aberto,
// para o operador não perder o motivo digitado e poder tentar de novo.
//
// Enquanto a ação está em andamento (até a lista recarregar), o botão acionado
// fica indisponível e um segundo clique na mesma ação do mesmo pedido é
// ignorado, em vez de ser enviado e recusado como se outro operador tivesse
// alterado o pedido. A trava é por pedido e ação: as demais ações continuam
// disponíveis.
async function runStatusAction(rescueRequest, action, data) {
  const key = actionKey(rescueRequest.id, action)
  if (actionsInProgress.value.includes(key)) {
    return
  }
  actionsInProgress.value = [...actionsInProgress.value, key]
  actionErrorMessage.value = ''

  let shouldRefresh = true
  try {
    await api.post(`/api/rescue-requests/${rescueRequest.id}/${action}`, data)
  } catch (error) {
    const isConflict = error.response?.status === 409
    actionErrorMessage.value = (isConflict && error.response.data?.message) || DEFAULT_ACTION_ERROR_MESSAGE
    shouldRefresh = isConflict
  }

  if (shouldRefresh) {
    cancelDialogRequest.value = null
    await fetchRescueRequests()
  }
  actionsInProgress.value = actionsInProgress.value.filter((inProgress) => inProgress !== key)
}

function handleAssume(rescueRequest) {
  return runStatusAction(rescueRequest, 'assume')
}

function handleComplete(rescueRequest) {
  return runStatusAction(rescueRequest, 'complete')
}

function openCancelDialog(rescueRequest) {
  cancelDialogRequest.value = rescueRequest
}

function handleCancelConfirm(reason) {
  return runStatusAction(cancelDialogRequest.value, 'cancel', { cancellation_reason: reason })
}

function shareLocation(rescueRequest) {
  const url = `https://www.google.com/maps?q=${rescueRequest.latitude},${rescueRequest.longitude}`

  // Sem HTTPS o navegador não oferece a área de transferência.
  if (!navigator.clipboard) {
    manualShareUrl.value = url
    return
  }

  navigator.clipboard
    .writeText(url)
    .then(() => {
      shareFeedback.value = true
    })
    .catch(() => {
      manualShareUrl.value = url
    })
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

    <div class="d-flex flex-wrap align-center ga-3 px-4 pb-3">
      <v-select
        v-model="statusFilter"
        :items="STATUS_OPTIONS"
        label="Status"
        density="compact"
        hide-details
        style="max-width: 200px"
      />

      <v-menu :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" variant="outlined" prepend-icon="mdi-filter-variant" class="text-none">
            Filtrar por quantidade
          </v-btn>
        </template>
        <v-card class="pa-4" style="width: 260px">
          <v-text-field
            v-for="{ field, label } in QUANTITY_FIELDS"
            :key="field"
            v-model="minQuantities[field]"
            :label="`Mín. ${label.toLowerCase()}`"
            type="number"
            min="0"
            density="compact"
            class="mb-2"
            hide-details
          />
          <v-btn variant="text" block class="text-none" @click="clearQuantityFilters">Limpar filtros</v-btn>
        </v-card>
      </v-menu>

      <v-select
        v-model="sortField"
        :items="SORT_FIELD_OPTIONS"
        label="Ordenar por"
        density="compact"
        hide-details
        style="max-width: 220px"
      />

      <v-btn-toggle v-model="sortDirection" mandatory density="compact" color="primary">
        <v-btn value="asc" icon="mdi-sort-ascending" />
        <v-btn value="desc" icon="mdi-sort-descending" />
      </v-btn-toggle>
    </div>

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
        :actions-in-progress="actionsInProgress"
        @select="handleSelect"
        @assume="handleAssume"
        @complete="handleComplete"
        @cancel="openCancelDialog"
        @share="shareLocation"
      />
    </div>

    <CancelRescueRequestDialog
      :model-value="Boolean(cancelDialogRequest)"
      :confirming="cancelInProgress"
      @update:model-value="(value) => { if (!value) cancelDialogRequest = null }"
      @confirm="handleCancelConfirm"
    />

    <!-- Snackbar em vez de v-alert: fica acima do scrim quando o diálogo de
         cancelamento continua aberto depois de uma falha. -->
    <v-snackbar
      :model-value="Boolean(actionErrorMessage)"
      color="error"
      timeout="-1"
      @update:model-value="(value) => { if (!value) actionErrorMessage = '' }"
    >
      {{ actionErrorMessage }}
      <template #actions>
        <v-btn variant="text" @click="actionErrorMessage = ''">Fechar</v-btn>
      </template>
    </v-snackbar>

    <v-snackbar v-model="shareFeedback" timeout="2500">
      Localização copiada para a área de transferência.
    </v-snackbar>

    <v-dialog
      :model-value="Boolean(manualShareUrl)"
      max-width="480"
      @update:model-value="(value) => { if (!value) manualShareUrl = '' }"
    >
      <v-card>
        <v-card-title>Compartilhar localização</v-card-title>
        <v-card-text>
          <p class="mb-3">A localização não pôde ser copiada automaticamente. Copie o link abaixo:</p>
          <a :href="manualShareUrl" target="_blank" rel="noopener" class="manual-share-url">{{ manualShareUrl }}</a>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="manualShareUrl = ''">Fechar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.manual-share-url {
  overflow-wrap: anywhere;
  user-select: all;
}

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
