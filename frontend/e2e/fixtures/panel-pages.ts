import { expect } from '@playwright/test'

const PER_PAGE_LABEL = 'Pedidos por página'

// O banco compartilhado acumula pedidos, então a lista do painel tem várias
// páginas e a posição de um pedido na ordenação pode cair em qualquer uma.
export async function showOneHundredPerPage(page) {
  await page.getByRole('combobox', { name: PER_PAGE_LABEL }).focus()
  await page.getByRole('combobox', { name: PER_PAGE_LABEL }).press('Enter')
  await page.getByRole('option', { name: '100', exact: true }).click()
  await expect(page.getByText(/^1-\d+ de \d+$/)).toBeVisible()
}

// Texto da lista inteira, da primeira à última página, na ordem em que os
// pedidos aparecem. Termina na última página.
export async function readAllPagesText(page): Promise<string> {
  const indicator = page.getByText(/^\d+-\d+ de \d+$/)
  const firstPage = page.getByRole('button', { name: 'Primeira página' })
  const nextPage = page.getByRole('button', { name: 'Próxima página' })

  if (await firstPage.isEnabled()) {
    await firstPage.click()
    await expect(indicator).toHaveText(/^1-/)
  }

  let text = ''
  for (;;) {
    text += `\n${await page.locator('.rescue-requests-list').innerText()}`
    if (await nextPage.isDisabled()) {
      return text
    }
    const current = await indicator.innerText()
    await nextPage.click()
    await expect(indicator).not.toHaveText(current)
  }
}
