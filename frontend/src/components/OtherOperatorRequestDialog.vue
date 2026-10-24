<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  // Nome do operador responsável pelo pedido.
  operatorName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title>Pedido de outro operador</v-card-title>
      <v-card-text>
        Este pedido é do operador {{ operatorName }}. Deseja continuar mesmo assim?
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Voltar</v-btn>
        <v-btn color="primary" @click="emit('confirm')">Continuar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
