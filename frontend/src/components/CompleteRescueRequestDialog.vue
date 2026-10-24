<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  // A conclusão confirmada ainda está em andamento.
  confirming: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const note = ref('')

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) {
      note.value = ''
    }
  },
)

// A observação é opcional: um texto só com espaços vale como não informada.
function confirm() {
  if (props.confirming) {
    return
  }
  emit('confirm', note.value.trim())
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title>Concluir pedido</v-card-title>
      <v-card-text>
        <v-textarea
          v-model="note"
          label="Observação da conclusão"
          rows="3"
          counter="1000"
          maxlength="1000"
          autofocus
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Voltar</v-btn>
        <v-btn color="success" :disabled="confirming" :loading="confirming" @click="confirm">
          Confirmar conclusão
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
