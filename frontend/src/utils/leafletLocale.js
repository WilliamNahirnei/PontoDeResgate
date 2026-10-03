import L from 'leaflet'

// Os botões de zoom do Leaflet vêm nomeados em inglês ("Zoom in"/"Zoom out"),
// e é esse nome que o leitor de tela lê (REQUISITOS.md §1.1).
L.Control.Zoom.mergeOptions({
  zoomInTitle: 'Aproximar',
  zoomOutTitle: 'Afastar',
})
