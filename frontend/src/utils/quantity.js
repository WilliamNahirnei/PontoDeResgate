// Quantidades de pessoas e animais: em branco é "não informada"; preenchida,
// precisa ser um inteiro de 0 a 999 (REQUISITOS.md §3.2 e §4.1).
export const MAX_QUANTITY = 999
export const INVALID_QUANTITY_MESSAGE = `Informe um número inteiro de 0 a ${MAX_QUANTITY}`

export function isValidQuantity(value) {
  if (value === '' || value === null || value === undefined) {
    return true
  }

  const number = Number(value)

  return Number.isInteger(number) && number >= 0 && number <= MAX_QUANTITY
}

export const quantityRules = [(value) => isValidQuantity(value) || INVALID_QUANTITY_MESSAGE]
