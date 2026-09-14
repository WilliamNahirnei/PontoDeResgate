<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/utils/leafletIcons'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const mapContainer = ref(null)
const DEFAULT_CENTER = [-23.5505, -46.6333]
const DEFAULT_ZOOM = 13

let map = null
let marker = null

function setPosition(lat, lng) {
  emit('update:modelValue', { lat, lng })

  if (marker) {
    marker.setLatLng([lat, lng])
    return
  }

  marker = L.marker([lat, lng], { draggable: true }).addTo(map)
  marker.on('dragend', () => {
    const position = marker.getLatLng()
    emit('update:modelValue', { lat: position.lat, lng: position.lng })
  })
}

onMounted(() => {
  const initialCenter = props.modelValue ? [props.modelValue.lat, props.modelValue.lng] : DEFAULT_CENTER

  map = L.map(mapContainer.value).setView(initialCenter, DEFAULT_ZOOM)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  if (props.modelValue) {
    setPosition(props.modelValue.lat, props.modelValue.lng)
  }

  map.on('click', (event) => {
    setPosition(event.latlng.lat, event.latlng.lng)
  })

  if (!props.modelValue && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      // Só usa a localização do navegador como pin padrão se o usuário
      // ainda não marcou uma manualmente enquanto a geolocalização
      // (assíncrona) estava sendo resolvida.
      if (!marker) {
        const { latitude, longitude } = position.coords
        map.setView([latitude, longitude], DEFAULT_ZOOM)
        setPosition(latitude, longitude)
      }
    })
  }
})

onBeforeUnmount(() => {
  map?.remove()
})
</script>

<template>
  <div ref="mapContainer" class="location-picker-map"></div>
</template>

<style scoped>
.location-picker-map {
  width: 100%;
  height: 100%;
  min-height: 320px;
  border-radius: 8px;
}
</style>
