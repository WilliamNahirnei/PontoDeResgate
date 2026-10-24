<script setup>
import { useLocale } from 'vuetify'

defineProps({
  page: {
    type: Number,
    required: true,
  },
  lastPage: {
    type: Number,
    required: true,
  },
  from: {
    type: Number,
    default: 0,
  },
  to: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  perPage: {
    type: Number,
    required: true,
  },
  perPageOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['update:page', 'update:perPage'])

// Os nomes dos botões vêm dos textos em português do próprio Vuetify (os mesmos
// das tabelas de operadores e logs).
const { t } = useLocale()
</script>

<template>
  <div class="rescue-requests-pagination d-flex flex-wrap align-center justify-end ga-2">
    <v-select
      :model-value="perPage"
      :items="perPageOptions"
      label="Pedidos por página"
      density="compact"
      hide-details
      style="max-width: 190px"
      @update:model-value="(value) => emit('update:perPage', value)"
    />
    <span class="text-body-2">{{ from }}-{{ to }} de {{ total }}</span>
    <v-btn
      icon="mdi-page-first"
      variant="text"
      density="comfortable"
      :aria-label="t('$vuetify.dataFooter.firstPage')"
      :disabled="page <= 1"
      @click="emit('update:page', 1)"
    />
    <v-btn
      icon="mdi-chevron-left"
      variant="text"
      density="comfortable"
      :aria-label="t('$vuetify.dataFooter.prevPage')"
      :disabled="page <= 1"
      @click="emit('update:page', page - 1)"
    />
    <v-btn
      icon="mdi-chevron-right"
      variant="text"
      density="comfortable"
      :aria-label="t('$vuetify.dataFooter.nextPage')"
      :disabled="page >= lastPage"
      @click="emit('update:page', page + 1)"
    />
    <v-btn
      icon="mdi-page-last"
      variant="text"
      density="comfortable"
      :aria-label="t('$vuetify.dataFooter.lastPage')"
      :disabled="page >= lastPage"
      @click="emit('update:page', lastPage)"
    />
  </div>
</template>
