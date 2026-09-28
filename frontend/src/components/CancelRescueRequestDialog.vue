<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const reason = ref('')

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) {
      reason.value = ''
    }
  },
)

function confirm() {
  if (!reason.value.trim()) {
    return
  }
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title>Cancelar pedido</v-card-title>
      <v-card-text>
        <v-textarea
          v-model="reason"
          label="Motivo do cancelamento"
          rows="3"
          counter="1000"
          maxlength="1000"
          autofocus
          required
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Voltar</v-btn>
        <v-btn color="error" :disabled="!reason.trim()" @click="confirm">Confirmar cancelamento</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
