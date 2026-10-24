import type { Locator, Page, Request } from '@playwright/test'

type StatusAction = 'assume' | 'complete' | 'cancel'

// Segura as chamadas de uma ação de status (assumir, concluir ou cancelar) de um
// pedido até o teste chamar release(). Sem isso, a primeira chamada pode terminar
// antes do segundo clique, e o duplo clique deixa de exercitar a ação em andamento.
export async function holdStatusAction(page: Page, rescueRequestId: number, action: StatusAction) {
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const requests: Request[] = []

  await page.route(`**/api/rescue-requests/${rescueRequestId}/${action}`, async (route) => {
    requests.push(route.request())
    await released
    await route.continue()
  })

  return {
    requests,
    // Libera as chamadas seguradas e espera todas terminarem.
    async releaseAndWait() {
      release()
      await Promise.all(requests.map((request) => request.response()))
    },
  }
}

// Conclui o pedido pelo diálogo de observação: abre com "Concluir", preenche a
// observação (opcional) e confirma.
export async function completeThroughDialog(page: Page, rescueCard: Locator, note?: string) {
  await rescueCard.getByRole('button', { name: 'Concluir' }).click()
  if (note !== undefined) {
    await page.getByLabel('Observação da conclusão').fill(note)
  }
  await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
}
