# Test plan — Resgates

> Cenários funcionais do sistema rodando — pedido público, painel, gestão de status e
> auditoria — derivados de [`REQUISITOS.md`](../../REQUISITOS.md) §3, §4.1 a §4.3, §4.5 e
> §7 e verificados por Playwright ou por exploração manual. Testes Unit e de endpoint do
> backend não entram aqui. Cenários que cruzam Usuarios e Resgates ficam em
> [`integrado.md`](./integrado.md).

## Legenda

**Camada** — este plano cobre só o comportamento funcional do sistema rodando. Testes Unit e de endpoint (Feature) do backend testam código e **não fazem parte dele**.

| Camada | Significado |
|---|---|
| `E2E` | Cenário verificável pela interface, automatizado (ou a automatizar) em Playwright, em `frontend/e2e/tests/`. |
| `Exploratório` | Cenário que exige algo fora da interface (ex.: manipular o banco) ou que só faz sentido explorar à mão; verificado com o sistema rodando, sem spec Playwright. |

**Status**

| Status | Significado |
|---|---|
| `Implementado` | Existe spec Playwright para o cenário e ele foi visto passando. |
| `Planejado` | A funcionalidade existe; o spec ainda não foi escrito, mas tem prioridade conhecida. |
| `Não coberto` | A funcionalidade existe; não há spec nem plano formal — candidato a ser priorizado. Para cenários `Exploratório` é o estado normal: não há automação. |
| `Não implementado` | A própria funcionalidade (não o teste) não existe no código, ou não foi possível confirmar que existe. |

## 1. Tela pública de pedido

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-14 | PublicRequestView | E2E | Cidadão registra um pedido de socorro com sucesso (mapa + formulário) | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("cidadão registra um pedido de socorro com sucesso") |  |
| RES-15 | PublicRequestView | E2E | Envio exige localização selecionada no mapa (botão fica desabilitado sem ela) | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("exige localização no mapa antes de enviar") |  |
| RES-16 | LocationPickerMap | E2E | Pin de localização é posicionado automaticamente via geolocalização do navegador, quando permitida | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("posiciona o pin automaticamente via geolocalização do navegador, quando permitida") |  |
| RES-79 | PublicRequestView | E2E | Tela pública não exibe link nem referência à área do operador (`/painel`, login), nem mesmo com uma sessão de operador salva no navegador | Não coberto | — | Requisito negativo de `REQUISITOS.md` §3. A proteção existe em `frontend/src/App.vue` (`showPanelBar` só aparece em rotas com `requiresAuth`), mas nenhum teste a protege. |
| RES-80 | LocationPickerMap | E2E | Quando a geolocalização é negada ou indisponível, o pin não é posicionado automaticamente e a pessoa marca a localização manualmente | Não coberto | — | RES-14 exercita a marcação manual, mas nenhum teste afirma o comportamento com a permissão negada (`REQUISITOS.md` §3.1). |
| RES-81 | LocationPickerMap | E2E | Pin posicionado automaticamente pela geolocalização pode ser ajustado manualmente depois | Não coberto | — | `REQUISITOS.md` §3.1. |
| RES-102 | PublicRequestView | E2E | Depois do envio, a tela mostra a confirmação sem identificador nem status do pedido, e "Enviar novo pedido" reabre o formulário e o mapa sem dados do envio anterior | Não coberto | — | `REQUISITOS.md` §3.3: reforçar o pedido só é possível enviando um novo. RES-14 para na mensagem de sucesso. |
| RES-103 | PublicRequestView | E2E | Se o envio falhar (erro de rede ou 5xx), a tela mostra a mensagem de erro e mantém os dados preenchidos para nova tentativa | Não coberto | — | Não está em `REQUISITOS.md` de forma explícita; decorre do objetivo de "registrar rapidamente, sem barreiras" (§1). Simular a falha interceptando a chamada. Baixa prioridade. |
| RES-125 | PublicRequestView → PanelView | E2E | Os dados informados no formulário público (nome, quantidades por categoria, animais e ponto de referência) aparecem no painel, no pedido criado | Não coberto | — | `REQUISITOS.md` §3.2. RES-14 só confere a mensagem de sucesso; nada prova que os campos chegam ao operador. |

## 2. Painel — visualização, filtros e ordenação

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-39 | PanelView (mapa) | E2E | Mapa exibe os pedidos georreferenciados; hover em um marcador mostra a quantidade de pessoas | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("hover em um marcador do mapa mostra a quantidade de pessoas e a data/hora do pedido") | Reescrito na auditoria de 2026-09-19: apesar do título, o teste só afirma a quantidade (`7 pessoa(s)`); a data/hora do tooltip não é verificada — ver RES-112. |
| RES-40 | PanelView (mapa) | E2E | Depois da primeira carga, atualizar a lista pelo botão "Atualizar" não reposiciona o mapa | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("mapa se ajusta automaticamente aos pedidos apenas na primeira carga") | Reescrito na auditoria de 2026-09-19: o teste só compara a posição de um marcador antes e depois de "Atualizar". Que o mapa *enquadra todos os pedidos* na primeira carga não é provado por nenhum teste (RES-113), nem que mudança de status ou de filtro também não reposiciona (RES-114). |
| RES-41 | PanelView | E2E | Mapa e lista exibem os mesmos pedidos simultaneamente (layout dividido, sem alternância por abas) | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("mapa e lista exibem os mesmos pedidos simultaneamente") | Requisito e implementação divergem: `REQUISITOS.md` §4.1 descreve a lista como "visualização alternativa ao mapa", mas a tela exibe mapa e lista lado a lado. Aguardando decisão de qual dos dois está correto. |
| RES-42 | PanelView | E2E | Clicar em um pedido na lista o destaca na própria lista; clicar em outro substitui o destaque anterior | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("clicar em um pedido na lista o destaca...") | Reescrito na auditoria de 2026-09-19: o teste só confere a classe do card na lista. O destaque no mapa (ícone do marcador e tooltip aberto) exigido por `REQUISITOS.md` §4.1 não é verificado — ver RES-111. |
| RES-43 | PanelView (filtros) | E2E | Filtro por status na UI reflete na lista | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("filtro por status reflete na lista") | Reescrito na auditoria de 2026-09-19: o teste só olha a lista; o reflexo nos marcadores do mapa (`REQUISITOS.md` §4.1: "mapa e lista") está em RES-110. |
| RES-44 | PanelView (filtros) | E2E | Filtro por quantidade mínima de total de pessoas na UI reflete na lista | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("filtro por quantidade mínima reflete na lista") | O teste só usa "Mín. total de pessoas". As demais quantidades (crianças, homens, mulheres, idosos, animais) não são exercitadas pela UI — ver RES-122. |
| RES-45 | PanelView (ordenação) | E2E | Ordenação crescente e decrescente por total de pessoas na UI | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("ordenação por quantidade reflete na ordem da lista") | Só a quantidade (total de pessoas) é exercitada. A ordenação por data/hora, primeira opção de `REQUISITOS.md` §4.1, não é testada — ver RES-109. |
| RES-109 | PanelView (ordenação) | E2E | Ordenar pela data/hora do pedido, nas duas direções, reordena a lista | Não coberto | — | Complementa RES-45, que só exercita quantidade. |
| RES-110 | PanelView (filtros) | E2E | Filtro por status na UI também altera os marcadores exibidos no mapa | Não coberto | — | Metade não provada de RES-43. |
| RES-111 | PanelView (mapa) | E2E | Clicar em um pedido na lista destaca o marcador dele no mapa e abre as informações; clicar em outro fecha as do anterior | Não coberto | — | Metade não provada de RES-42. O código troca o ícone do marcador e abre/fecha o tooltip (`RescueRequestsMap.vue`), mas o teste só olha o card da lista. |
| RES-112 | PanelView (mapa) | E2E | Hover em um marcador mostra também a data/hora do pedido | Não coberto | — | Metade não provada de RES-39. |
| RES-113 | PanelView (mapa) | E2E | Na primeira carga, o mapa se ajusta para enquadrar todos os pedidos, sem partir de uma região fixa | Não coberto | — | Metade não provada de RES-40 (`REQUISITOS.md` §4.1: a implantação pode ser em qualquer cidade). Sugestão: pedidos em duas cidades distantes e verificar que ambos os marcadores ficam visíveis. |
| RES-114 | PanelView (mapa) | E2E | Depois da primeira carga, mudar o status de um pedido ou o filtro não reposiciona o mapa | Não coberto | — | Metade não provada de RES-40; RES-40 só exercita o botão "Atualizar". |
| RES-115 | PanelView (filtros) | E2E | "Limpar filtros" nos filtros de quantidade restaura a lista completa | Não coberto | — | Funcionalidade existente (`clearQuantityFilters` em `PanelView.vue`) sem teste; baixa prioridade. |
| RES-122 | PanelView (filtros) | E2E | Filtro por quantidade mínima funciona para cada categoria (crianças, homens, mulheres, idosos, animais), não só para o total | Não coberto | — | Complementa RES-44. |
| RES-123 | PanelView (filtros) | E2E | Pedido em que a quantidade filtrada não foi informada some da lista e do mapa quando um filtro mínimo é aplicado | Não coberto | — | `REQUISITOS.md` §4.1: o filtro considera "apenas os pedidos que tiverem essa informação preenchida". |
| RES-124 | PanelView (ordenação) | E2E | Ao ordenar por uma quantidade, os pedidos sem essa quantidade informada ficam no fim da lista, tanto em ordem crescente quanto decrescente | Não coberto | — | Regra de comportamento do sistema, não escrita em `REQUISITOS.md` (que só diz que a lista "pode ser ordenada"): confirmar se é a desejada. |

## 3. Painel — gestão de status

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-58 | PanelView | E2E | Assumir pedido pendente pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador assume um pedido pendente pela UI") |  |
| RES-59 | PanelView | E2E | Concluir pedido em atendimento pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador conclui um pedido em atendimento pela UI") |  |
| RES-60 | PanelView | E2E | Cancelar pedido informando motivo pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador cancela um pedido informando o motivo pela UI") |  |
| RES-61 | PanelView | E2E | Compartilhar localização copia os dados para a área de transferência e mostra confirmação visual | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("compartilhar localização copia a URL para a área de transferência") | Teste força `navigator.share` a `undefined` para exercitar o fallback de clipboard de forma determinística (ver comentário no spec). |
| RES-99 | PanelView | E2E | Compartilhar localização usa o compartilhamento nativo do dispositivo quando `navigator.share` está disponível | Não coberto | — | RES-61 só exercita o fallback de clipboard. `REQUISITOS.md` §4.2 tem dois bullets "Compartilhar localização" com textos diferentes (cópia para a área de transferência vs. compartilhar para acionar equipe externa) — consolidar o requisito. |
| RES-116 | RescueRequestsList | E2E | Os botões de ação do card seguem o status: pendente mostra Assumir e Cancelar; em_resgate mostra Concluir e Cancelar; concluído e cancelado não mostram nenhuma ação de transição; "Compartilhar localização" aparece em todos | Não coberto | — | Máquina de estados na UI. Hoje só é provado de forma incidental: RES-58 (some Assumir, aparece Concluir) e RES-59 (somem Concluir e Cancelar). Não há verificação de que pendente não oferece Concluir nem de que cancelado não oferece nada. |
| RES-117 | RescueRequestsList | E2E | Depois de assumir, o card do pedido mostra o operador responsável | Não coberto | — | `REQUISITOS.md` §4.2 ("registra o operador responsável"): o card exibe "Operador responsável: <nome>" quando o pedido tem operador. |
| RES-118 | PanelView | E2E | Quando uma ação de status falha (por exemplo 409 porque outro operador já assumiu o pedido), o operador vê uma mensagem de erro e a lista é atualizada | Não implementado | — | Buscado em `frontend/src/views/PanelView.vue`: `handleAssume`, `handleComplete` e `handleCancelConfirm` não têm `try/catch`. No 409 a promise é rejeitada sem aviso, a lista não recarrega e o diálogo de cancelamento continua aberto. `OperatorsListView` trata o erro; o painel não. Cenário central quando dois operadores disputam o mesmo pedido (ver RES-129). **`REQUISITOS.md` não especifica o comportamento** — confirmar com o responsável antes de implementar ou testar. |
| RES-126 | PanelView | E2E | Operador cancela pela UI um pedido já em atendimento (em resgate), informando o motivo | Não coberto | — | RES-60 só cancela pedido pendente. |
| RES-127 | PanelView | E2E | Um operador diferente do que assumiu o pedido consegue concluí-lo pela UI | Não coberto | — | Regra confirmada pelo responsável do projeto em 2026-09-18: qualquer operador autenticado pode. `REQUISITOS.md` §4.2 é omisso — recomenda-se registrá-la lá. Exige duas sessões (dois contextos de navegador). |
| RES-128 | PanelView | E2E | Um operador diferente do que assumiu o pedido consegue cancelá-lo pela UI | Não coberto | — | Ver RES-127. |
| RES-129 | PanelView | E2E | Página desatualizada: o operador A assume um pedido pendente e o operador B, que ainda vê o pedido como pendente, clica em Assumir; depois de atualizar, o pedido continua com o operador A | Não coberto | — | Reprodução determinística da disputa entre dois operadores. A mensagem de erro que B deveria ver depende de RES-118 (Não implementado). A corrida real de requisições simultâneas é questão de código, fora deste plano. |

## 4. Auditoria (tela de logs)

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-69 | RescueStatusLogsView | E2E | Tela de logs de auditoria exibe o pedido e a mudança de status (anterior e novo) de cada log, e é paginada | Implementado | `frontend/e2e/tests/rescue-status-logs.spec.ts` ("exibe o pedido, o operador e a mudança de status de cada log", "lista de logs é paginada") | Reescrito na auditoria de 2026-09-19: apesar do título do primeiro teste, ele não afirma o operador nem a data/hora — ver RES-120. |
| RES-120 | RescueStatusLogsView | E2E | Cada linha da tela de logs mostra o operador responsável e a data/hora da mudança | Não coberto | — | Metade não provada de RES-69. |
| RES-119 | RescueStatusLogsView | Exploratório | A tela de logs continua abrindo e mantém o log na lista quando o pedido relacionado foi removido por soft delete | Não coberto | — | Reprodução manual: com o sistema de pé, criar um pedido, assumi-lo (gera log), apagá-lo por soft delete via `docker compose exec backend php artisan tinker` (`RescueRequest::find(<id>)->delete()`) e abrir `/painel/logs` como admin master. **Bug confirmado em 2026-09-19** por teste descartável (já removido): a API responde 500 (`Attempt to read property "id" on null`), porque `RescueStatusLogRepository::paginateWithRelations` carrega `rescueRequest` sem `withTrashed()`. `REQUISITOS.md` §4.3 exige soft delete e log de toda mudança; a trilha de auditoria não pode quebrar por isso. Hoje não há como apagar um pedido pela interface, então só ocorre por remoção manual ou funcionalidade futura; como o dado é apagado fora da UI, o cenário fica exploratório. |
