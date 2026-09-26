// Texto da quantidade total de pessoas de um pedido, igual no hover do mapa e
// no card da lista. O total é opcional no pedido público (REQUISITOS.md §3.2)
// e, quando falta, o texto precisa dizer que não foi informado (§4.1).
export function formatTotalPeople(totalPeople) {
  return totalPeople == null ? 'Quantidade de pessoas não informada' : `${totalPeople} pessoa(s)`
}
