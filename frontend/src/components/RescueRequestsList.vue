<script setup>
import { nextTick, watch } from 'vue'
import { formatTotalPeople } from '@/utils/rescueRequestFormat'

const props = defineProps({
  rescueRequests: {
    type: Array,
    default: () => [],
  },
  selectedId: {
    type: Number,
    default: null,
  },
  // Ações de status em andamento, como chaves "<id do pedido>:<ação>".
  actionsInProgress: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select', 'assume', 'complete', 'cancel', 'share'])

// Cards da lista por id do pedido, para rolar até o selecionado.
const cardElements = new Map()

function setCardElement(id, component) {
  if (component) {
    cardElements.set(id, component.$el)
  } else {
    cardElements.delete(id)
  }
}

// Quando o pedido é selecionado pelo mapa e o card não está visível, a lista
// rola até ele (REQUISITOS.md §4.1). "nearest" não mexe na lista se o card
// já está à vista, como ao clicar no próprio card.
watch(
  () => props.selectedId,
  async (id) => {
    if (id == null) {
      return
    }
    await nextTick()
    cardElements.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)

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

const PEOPLE_CATEGORIES = [
  { field: 'men_count', label: 'Homens' },
  { field: 'women_count', label: 'Mulheres' },
  { field: 'children_count', label: 'Crianças' },
  { field: 'elderly_count', label: 'Idosos' },
]

function isInProgress(rescueRequest, action) {
  return props.actionsInProgress.includes(`${rescueRequest.id}:${action}`)
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR')
}

// Só as categorias informadas no pedido; zero conta como informado.
function peopleComposition(rescueRequest) {
  return PEOPLE_CATEGORIES.filter(({ field }) => rescueRequest[field] != null)
    .map(({ field, label }) => `${label}: ${rescueRequest[field]}`)
    .join(' · ')
}
</script>

<template>
  <div class="rescue-requests-list">
    <v-card
      v-for="rescueRequest in rescueRequests"
      :key="rescueRequest.id"
      :ref="(component) => setCardElement(rescueRequest.id, component)"
      class="mb-2 pa-3"
      :variant="rescueRequest.id === selectedId ? 'tonal' : 'outlined'"
      :color="rescueRequest.id === selectedId ? 'primary' : undefined"
      @click="emit('select', rescueRequest.id)"
    >
      <div class="d-flex align-center justify-space-between mb-1">
        <v-chip :color="STATUS_COLORS[rescueRequest.status]" size="small" variant="flat">
          {{ STATUS_LABELS[rescueRequest.status] }}
        </v-chip>
        <span class="text-caption text-medium-emphasis">{{ formatDateTime(rescueRequest.created_at) }}</span>
      </div>

      <div class="text-subtitle-2">{{ rescueRequest.requester_name || 'Pedido sem nome informado' }}</div>
      <div class="text-body-2 text-medium-emphasis">
        {{ formatTotalPeople(rescueRequest.total_people) }}
        <span v-if="rescueRequest.animals_count">· {{ rescueRequest.animals_count }} animal(is)</span>
      </div>
      <div v-if="peopleComposition(rescueRequest)" class="text-body-2 text-medium-emphasis">
        {{ peopleComposition(rescueRequest) }}
      </div>
      <div v-if="rescueRequest.reference_point" class="text-body-2 text-medium-emphasis">
        Referência: {{ rescueRequest.reference_point }}
      </div>
      <div v-if="rescueRequest.operator" class="text-body-2 text-medium-emphasis">
        Operador responsável: {{ rescueRequest.operator.name }}
      </div>
      <div v-if="rescueRequest.cancellation_reason" class="text-body-2 text-medium-emphasis">
        Motivo do cancelamento: {{ rescueRequest.cancellation_reason }}
      </div>
      <div v-if="rescueRequest.completion_note" class="text-body-2 text-medium-emphasis">
        Observação da conclusão: {{ rescueRequest.completion_note }}
      </div>

      <div class="d-flex flex-wrap ga-2 mt-3">
        <v-btn
          v-if="rescueRequest.status === 'pendente'"
          size="small"
          color="primary"
          :disabled="isInProgress(rescueRequest, 'assume')"
          :loading="isInProgress(rescueRequest, 'assume')"
          @click.stop="emit('assume', rescueRequest)"
        >
          Assumir
        </v-btn>
        <v-btn
          v-if="rescueRequest.status === 'em_resgate'"
          size="small"
          color="success"
          :disabled="isInProgress(rescueRequest, 'complete')"
          :loading="isInProgress(rescueRequest, 'complete')"
          @click.stop="emit('complete', rescueRequest)"
        >
          Concluir
        </v-btn>
        <v-btn
          v-if="['pendente', 'em_resgate'].includes(rescueRequest.status)"
          size="small"
          color="error"
          variant="outlined"
          @click.stop="emit('cancel', rescueRequest)"
        >
          Cancelar
        </v-btn>
        <v-btn size="small" variant="text" prepend-icon="mdi-share-variant" @click.stop="emit('share', rescueRequest)">
          Compartilhar localização
        </v-btn>
      </div>
    </v-card>

    <p v-if="!rescueRequests.length" class="text-center text-medium-emphasis py-8">
      Nenhum pedido encontrado.
    </p>
  </div>
</template>

<style scoped>
.rescue-requests-list {
  height: 100%;
  overflow-y: auto;
}
</style>
