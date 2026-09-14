<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/utils/leafletIcons'

const props = defineProps({
  rescueRequests: {
    type: Array,
    default: () => [],
  },
  selectedId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['select'])

const mapContainer = ref(null)
const DEFAULT_CENTER = [-23.5505, -46.6333]

const STATUS_COLORS = {
  pendente: '#e53935',
  em_resgate: '#1e88e5',
  concluido: '#43a047',
  cancelado: '#757575',
}

let map = null
const markers = new Map()

function buildIcon(status, isSelected) {
  const color = STATUS_COLORS[status] ?? '#e53935'
  const size = isSelected ? 26 : 18

  return L.divIcon({
    className: 'rescue-request-marker',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR')
}

function rebuildMarkers() {
  markers.forEach((marker) => marker.remove())
  markers.clear()

  props.rescueRequests.forEach((rescueRequest) => {
    const marker = L.marker([rescueRequest.latitude, rescueRequest.longitude], {
      icon: buildIcon(rescueRequest.status, rescueRequest.id === props.selectedId),
    })

    marker.bindTooltip(
      `${rescueRequest.total_people ?? '?'} pessoa(s) · ${formatDateTime(rescueRequest.created_at)}`,
    )

    marker.on('click', () => emit('select', rescueRequest.id))
    marker.addTo(map)

    markers.set(rescueRequest.id, marker)
  })
}

function refreshSelection() {
  markers.forEach((marker, id) => {
    const rescueRequest = props.rescueRequests.find((item) => item.id === id)
    if (!rescueRequest) {
      return
    }
    marker.setIcon(buildIcon(rescueRequest.status, id === props.selectedId))
  })

  if (props.selectedId && markers.has(props.selectedId)) {
    const marker = markers.get(props.selectedId)
    map.panTo(marker.getLatLng())
    marker.openTooltip()
  }
}

onMounted(() => {
  map = L.map(mapContainer.value).setView(DEFAULT_CENTER, 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  rebuildMarkers()
})

watch(() => props.rescueRequests, rebuildMarkers, { deep: true })
watch(() => props.selectedId, refreshSelection)

onBeforeUnmount(() => {
  map?.remove()
})
</script>

<template>
  <div ref="mapContainer" class="rescue-requests-map"></div>
</template>

<style scoped>
.rescue-requests-map {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}
</style>
