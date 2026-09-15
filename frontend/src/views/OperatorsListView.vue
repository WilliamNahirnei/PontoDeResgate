<script setup>
import { ref, watch } from 'vue'
import api from '@/services/api'

const operators = ref([])
const totalOperators = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const togglingId = ref(null)
const successMessage = ref('')
const showSuccess = ref(false)

const nameFilter = ref('')
const emailFilter = ref('')

const page = ref(1)
const itemsPerPage = ref(10)

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Status', key: 'active', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

let filterTimeout = null

async function fetchOperators() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/operators', {
      params: {
        page: page.value,
        per_page: itemsPerPage.value,
        name: nameFilter.value || undefined,
        email: emailFilter.value || undefined,
      },
    })
    operators.value = response.data.data
    totalOperators.value = response.data.meta.total
  } catch {
    errorMessage.value = 'Não foi possível carregar os operadores.'
  } finally {
    loading.value = false
  }
}

function handleOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  fetchOperators()
}

watch([nameFilter, emailFilter], () => {
  clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => {
    page.value = 1
    fetchOperators()
  }, 400)
})

async function toggleActive(operator) {
  togglingId.value = operator.id
  const action = operator.active ? 'deactivate' : 'activate'

  try {
    const response = await api.post(`/api/operators/${operator.id}/${action}`)
    const index = operators.value.findIndex((item) => item.id === operator.id)
    if (index !== -1) {
      operators.value[index] = response.data.data
    }
    successMessage.value = response.data.data.active
      ? 'Operador ativado com sucesso.'
      : 'Operador desativado com sucesso.'
    showSuccess.value = true
  } catch {
    errorMessage.value = 'Não foi possível atualizar o status do operador.'
  } finally {
    togglingId.value = null
  }
}
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap ga-2">
      <h1 class="text-h6">Operadores</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'operators-create' }">
        Novo operador
      </v-btn>
    </div>

    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-text-field
        v-model="nameFilter"
        label="Filtrar por nome"
        density="compact"
        clearable
        hide-details
        style="max-width: 280px"
      />
      <v-text-field
        v-model="emailFilter"
        label="Filtrar por e-mail"
        density="compact"
        clearable
        hide-details
        style="max-width: 280px"
      />
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-data-table-server
      :headers="headers"
      :items="operators"
      :items-length="totalOperators"
      :items-per-page="itemsPerPage"
      :loading="loading"
      items-per-page-text="Operadores por página"
      no-data-text="Nenhum operador encontrado."
      @update:options="handleOptionsUpdate"
    >
      <template #[`item.active`]="{ item }">
        <v-chip :color="item.active ? 'success' : 'error'" size="small" variant="tonal">
          {{ item.active ? 'Ativo' : 'Inativo' }}
        </v-chip>
      </template>

      <template #[`item.actions`]="{ item }">
        <v-btn
          size="small"
          variant="tonal"
          :color="item.active ? 'error' : 'success'"
          :loading="togglingId === item.id"
          @click="toggleActive(item)"
        >
          {{ item.active ? 'Desativar' : 'Ativar' }}
        </v-btn>
      </template>
    </v-data-table-server>

    <v-snackbar v-model="showSuccess" :timeout="2500" color="success">
      {{ successMessage }}
    </v-snackbar>
  </div>
</template>
