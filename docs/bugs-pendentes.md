# Bugs pendentes

Lista de trabalho dos bugs conhecidos que ainda não foram corrigidos, para continuar entre
sessões. A origem é a exploração de 2026-09-19
([`test-runs/2026-09-19-e2e-e-exploratorio.md`](./test-runs/2026-09-19-e2e-e-exploratorio.md)),
atualizada com as correções feitas depois. Diferente dos relatórios de `test-runs/`, este
arquivo **é editado**: quando um bug for corrigido, remova-o daqui e registre o commit em
"Já corrigidos".

Última atualização: 2026-10-17.

## Estado da suíte

- **E2E:** 143 testes, todos passam na suíte completa com reset do banco (correção da
  sessão recusada, 2026-10-17).
- **Testes lentos com o banco cheio:** o painel desenha todos os pedidos de uma vez. Sem
  reset, as execuções acumulam pedidos e a lista demora a aparecer com a suíte em
  paralelo. Com 716 pedidos (2026-10-03), 50 testes do painel estouraram a espera de 5s
  e passaram depois do reset. Antes disso, com menos pedidos, só dois testes ficavam
  perto do limite de 30s: "filtro por quantidade mínima funciona para cada categoria"
  (`frontend/e2e/tests/panel-filters-sorting.spec.ts`) e o de RES-118
  (`frontend/e2e/tests/panel-status-management.spec.ts`).
- **Backend:** 309 testes, todos passam.

## Como corrigir

Cada bug segue o mesmo plano de 5 passos, pedindo confirmação ao usuário antes de cada um:

1. Identificar a causa e onde ela ocorre.
2. Se o bug for no backend e não houver teste unitário para o requisito, escrever os testes
   do comportamento correto (eles falham).
3. Corrigir o bug onde ele ocorre.
4. Rodar a suíte completa do backend: todos devem passar.
5. Rodar a suíte E2E completa: todos devem passar.

Quando a correção mudar uma regra ou uma mensagem, ajustar primeiro o `REQUISITOS.md` com a
skill `po-requisitos`, depois os planos com `qa-analyst` e os specs com `qa-automator`.

## A corrigir

Nenhum.

## Pendentes de decisão (comportamento não definido no requisito)

Nenhum.

## Não serão corrigidos

- **Filtro de nome com `%` traz todos os pedidos:** o curinga do `LIKE` não é escapado.
  Descartado em 2026-10-03 por decisão do usuário: digitar `%` no filtro não acontece no
  uso prático.
- **Botões dos cards no celular têm 28 px** de altura, abaixo dos 44 px recomendados para
  toque. Descartado em 2026-10-15 por decisão do usuário: por enquanto o sistema não é
  pensado para uso no celular. Reavaliar se o uso em campo pelo celular entrar no escopo.
- **Sem limite de tentativas** no login nem no envio público. Descartado em 2026-10-15 por
  decisão do usuário: não é necessário agora. Reavaliar antes de expor o sistema em produção.
- **Marcadores empilhados no mapa**, porque não há agrupamento. Descartado em 2026-10-15 por
  decisão do usuário: os marcadores não serão agrupados.

## Já corrigidos

| Bug | Commit |
|---|---|
| RES-125: o card não mostrava a composição do grupo | `247f2e5` |
| RES-146: o hover e o card mostravam "?" sem total informado | `2a74ae5` |
| A1: dois operadores conseguiam assumir o mesmo pedido | `10a5031` |
| M2: ação de status recusada não dava retorno na tela; motivo do cancelamento sem limite na tela | `490bd72` |
| M1: duplo clique em Assumir, Concluir ou Confirmar cancelamento mostrava mensagem de recusa | `37badb6` |
| M3: quantidade sem máximo derrubava o envio público com 500; erro sem apontar o campo; textos sem contador | `7cd1128` |
| A2: tela de logs com erro 500 com pedido apagado por soft delete | `4f44986` |
| M4: "Compartilhar localização" sem área de transferência não dava retorno; agora mostra o link para cópia manual | `5f79cb7` |
| Mensagens em inglês: validação, respostas da API, paginação, textos de acessibilidade e idioma da página passam a português | `ad65f73` |
| Sem página 404: endereço inexistente leva à tela de pedido (sem sessão) ou ao painel (com sessão) | `16b7b8d` |
| Filtro de quantidade mínima inválido: mensagem no próprio campo e lista mantida, sem o alerta genérico | `ffa07a7` |
| Título da aba era "Vite App": passa a ser "PontoDeResgate" em todas as telas | `a5cafe1` |
| Cadastro de operador com mais de um erro mostrava só o primeiro: cada mensagem passa a aparecer no próprio campo | `65cb11f` |
| Papel forjado no `localStorage` abria a estrutura das telas de admin para um operador: o papel passa a valer só depois de confirmado pelo servidor | `d09eb03` |
| Operador desativado com a sessão aberta (USR-61): autenticação recusada apaga a sessão e leva ao login com o alerta "Sua sessão expirou. Faça login novamente." | `9ee7ff5` |
