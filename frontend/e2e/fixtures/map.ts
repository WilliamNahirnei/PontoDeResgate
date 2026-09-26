import { expect, type Locator } from '@playwright/test'

// Posição de um elemento do mapa depois que ele para de se mover: o
// enquadramento da primeira carga (e o panTo da seleção) são animados, e medir
// durante a animação dá uma posição que ainda vai mudar. Espera duas leituras
// seguidas iguais.
export async function stableBoundingBox(locator: Locator) {
  let previous = null
  let current = null

  await expect
    .poll(async () => {
      previous = current
      current = await locator.boundingBox()
      return (
        previous !== null &&
        current !== null &&
        Math.abs(current.x - previous.x) < 0.5 &&
        Math.abs(current.y - previous.y) < 0.5
      )
    })
    .toBe(true)

  return current
}

// Coordenada aleatória dentro do Brasil, para o marcador do teste não cair em
// cima dos marcadores de outros testes (o banco acumula pedidos entre execuções).
export function randomCoordinates() {
  return {
    latitude: -30 + Math.random() * 27,
    longitude: -60 + Math.random() * 25,
  }
}
