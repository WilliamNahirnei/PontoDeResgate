# Ideias para o PontoDeResgate

Anotações de funcionalidades que ainda **não são requisito**. Quando uma ideia for
refinada, ela passa pela skill `po-requisitos` e só então entra no `REQUISITOS.md`.

## Filtro de pedidos por operador que realizou ação

- **Anotada em:** 2026-10-17
- **Ideia:** na tela de pedidos do painel (§4.1 do `REQUISITOS.md`), um filtro para listar
  os pedidos em que um operador realizou ação.
- **Pontos a definir antes de virar requisito:**
  - Qual operador: qualquer um, escolhido numa lista, ou só os pedidos do próprio usuário.
  - O que conta como ação: qualquer entrada do log de operações (assumir, concluir,
    cancelar) ou só o operador responsável que assumiu o pedido.
  - Se operadores desativados aparecem na escolha do filtro.
  - Como combina com os demais filtros, com o mapa e com "Limpar filtros".
