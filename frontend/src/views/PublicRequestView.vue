<script setup>
import { reactive, ref } from 'vue'
import LocationPickerMap from '@/components/LocationPickerMap.vue'
import api from '@/services/api'
import { MAX_QUANTITY, quantityRules } from '@/utils/quantity'

const location = ref(null)

const form = reactive({
  requester_name: '',
  total_people: null,
  men_count: null,
  women_count: null,
  children_count: null,
  elderly_count: null,
  animals_count: null,
  reference_point: '',
})

const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')

async function handleSubmit(submitEvent) {
  const { valid } = await submitEvent
  if (!valid) {
    return
  }

  if (!location.value) {
    errorMessage.value = 'Selecione a localização no mapa antes de enviar.'
    return
  }

  errorMessage.value = ''
  submitting.value = true

  try {
    await api.post('/api/rescue-requests', {
      latitude: location.value.lat,
      longitude: location.value.lng,
      requester_name: form.requester_name || null,
      total_people: form.total_people,
      men_count: form.men_count,
      women_count: form.women_count,
      children_count: form.children_count,
      elderly_count: form.elderly_count,
      animals_count: form.animals_count,
      reference_point: form.reference_point || null,
    })

    submitted.value = true
  } catch {
    errorMessage.value = 'Não foi possível enviar o pedido. Tente novamente.'
  } finally {
    submitting.value = false
  }
}

function handleNewRequest() {
  submitted.value = false
  location.value = null
  form.requester_name = ''
  form.total_people = null
  form.men_count = null
  form.women_count = null
  form.children_count = null
  form.elderly_count = null
  form.animals_count = null
  form.reference_point = ''
}
</script>

<template>
  <v-container class="py-8" style="max-width: 720px">
    <h1 class="text-h5 font-weight-bold mb-2">Pedido de socorro</h1>
    <p class="text-body-2 mb-6">
      Marque no mapa o local onde está a pessoa em situação de risco. Os demais dados são
      opcionais, mas ajudam as equipes a se prepararem.
    </p>

    <template v-if="submitted">
      <v-alert type="success" variant="tonal" class="mb-4">
        Pedido enviado com sucesso. Uma equipe irá avaliar a solicitação.
      </v-alert>
      <v-btn color="primary" @click="handleNewRequest">Enviar novo pedido</v-btn>
    </template>

    <v-form v-else @submit.prevent="handleSubmit">
      <div class="mb-2" style="height: 360px">
        <LocationPickerMap v-model="location" />
      </div>
      <p v-if="!location" class="text-caption text-medium-emphasis mb-4">
        Toque no mapa para marcar a localização. Você pode ajustar arrastando o marcador.
      </p>
      <p v-else class="text-caption text-medium-emphasis mb-4">
        Localização selecionada: {{ location.lat.toFixed(5) }}, {{ location.lng.toFixed(5) }}
      </p>

      <v-text-field
        v-model="form.requester_name"
        label="Nome (opcional)"
        counter="255"
        persistent-counter
        maxlength="255"
        class="mb-2"
      />

      <v-row dense>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.total_people"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Total de pessoas"
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.men_count"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Homens"
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.women_count"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Mulheres"
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.children_count"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Crianças"
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.elderly_count"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Idosos"
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="form.animals_count"
            type="number"
            min="0"
            :max="MAX_QUANTITY"
            :rules="quantityRules"
            label="Animais"
          />
        </v-col>
      </v-row>

      <v-textarea
        v-model="form.reference_point"
        label="Ponto de referência (opcional)"
        rows="2"
        counter="1000"
        persistent-counter
        maxlength="1000"
        class="mb-2"
      />

      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
        {{ errorMessage }}
      </v-alert>

      <v-btn type="submit" color="primary" block :loading="submitting" :disabled="!location">
        Enviar pedido
      </v-btn>
    </v-form>
  </v-container>
</template>
