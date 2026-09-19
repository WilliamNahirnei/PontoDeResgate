# Test plan — Visão integrada

> Matriz de rastreabilidade consolidada e fluxos cross-module (Usuarios + Resgates). Não
> duplica cenários dos arquivos de módulo — referencia-os pelo ID. Cenários
> exclusivamente cross-module (cujo teste ou fluxo, em si, mistura os dois domínios, não
> apenas usa autenticação como pré-condição incidental) vivem só aqui, prefixo `CRZ-xx`.

## Como este arquivo se relaciona com os arquivos de módulo

- [`usuarios.md`](./usuarios.md) e [`resgates.md`](./resgates.md) são a fonte de verdade
  cenário a cenário de cada módulo.
- Este arquivo referencia esses cenários pelo ID (ex.: "USR-13") sem repetir a descrição —
  ao atualizar um cenário, edite apenas o arquivo de módulo correspondente.
- Um cenário só ganha ID próprio aqui (`CRZ-xx`) quando a própria checagem que ele faz
  depende dos dois domínios ao mesmo tempo — por exemplo, "só admin master pode ver os
  logs" mistura o papel de Usuarios com o dado de Resgates. Um teste que apenas *usa* um
  operador autenticado como pré-condição para exercitar uma regra que é, em si, só de
  Resgates (ex.: transição de status de um pedido) fica no arquivo de módulo, não aqui.

## Matriz de rastreabilidade (requisito → módulo → camada → status)

| Requisito (`REQUISITOS.md`) | Módulo(s) | Camadas cobertas | Status geral | Cenários |
|---|---|---|---|---|
| §2 Papéis de usuário / autenticação | Usuarios | Unit, Feature, E2E | Parcial — guarda de autenticação incompleta (USR-58, USR-59 Não coberto) | USR-01–USR-22, USR-58–USR-59 |
| §3 Tela pública de pedido | Resgates | Unit, Feature, E2E | Parcial — RES-78 a RES-81 Não coberto (persistência dos campos, requisito negativo do painel, geolocalização negada, ajuste do pin) | RES-01–RES-17, RES-77–RES-81 |
| §4.1 Visualização de pedidos (painel) | Resgates | Unit, Feature, E2E | Implementado (requisito × implementação divergem em "lista alternativa ao mapa", ver RES-41) | RES-18–RES-45 |
| §4.2 Gestão de status do pedido | Resgates | Unit, Feature, E2E | Parcial — RES-85 a RES-99 Não coberto (transições inválidas via HTTP, 404, concorrência, operador diferente, `navigator.share`) | RES-46–RES-62, RES-70–RES-76, RES-82, RES-85–RES-99 |
| §4.3 Auditoria (regra de negócio) | Resgates | Unit, Feature | Parcial — log ao cancelar sem teste Feature (RES-84); transição bloqueada sem prova de "sem log" (RES-93) | RES-62–RES-66, RES-82–RES-84, RES-93 |
| §4.4 Cadastro e gestão de operadores | Usuarios | Unit, Feature, E2E | Parcial — token de desativado (USR-60) e admin master fora do escopo de ativar/desativar (USR-62, USR-63) Não coberto; sessão aberta de desativado Não implementado (USR-61) | USR-23–USR-57, USR-60–USR-63 |
| §4.5 Consulta de logs de operações | Resgates + Usuarios (autorização) | Unit, Feature, E2E | Implementado | RES-63–RES-69, CRZ-01, CRZ-02 |
| §5 Alertas em tempo real (websocket) | Resgates + Usuarios | — | Não implementado / não confirmado | CRZ-05 |
| §9 Ambiente de desenvolvimento (admin master semeado) | Usuarios | Feature | Não coberto | USR-64 |
| Navegação condicional por papel (menus e rotas exclusivos de admin master) | Usuarios + Resgates | E2E | Implementado | USR-57, CRZ-04, CRZ-06 |

## Fluxos cross-module

| ID | Fluxo | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| CRZ-01 | Auditoria (autorização) | Feature | Consulta de logs de status é exclusiva do papel admin master | Implementado | `backend/tests/Feature/RescueStatusLogListingTest.php::test_regular_operator_cannot_list_rescue_status_logs` | |
| CRZ-02 | Auditoria (autorização) | Feature | Consulta de logs de status exige autenticação | Implementado | `backend/tests/Feature/RescueStatusLogListingTest.php::test_guests_cannot_list_rescue_status_logs` | |
| CRZ-03 | Painel completo | E2E | Login como operador → visualizar, filtrar, assumir e cancelar um pedido, ponta a ponta | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("fluxo completo do painel: operador visualiza, filtra, assume e cancela um pedido") | |
| CRZ-04 | Navegação por papel | E2E | Admin master vê os itens de menu de gestão de operadores e de logs; operador comum não vê nenhum dos dois | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("admin master vê os itens de menu de gestão de operadores e de logs", "operador comum não vê os itens de menu de gestão de operadores nem de logs") | |
| CRZ-05 | Alertas em tempo real | — | Operadores conectados recebem um alerta via websocket quando um novo pedido é criado (`REQUISITOS.md` §5) | Não implementado | — | Nenhum código (`websocket`/`broadcast`/`pusher`/`reverb`) nem teste correspondente foi localizado em backend ou frontend. Precisa de uma investigação/confirmação de escopo antes de qualquer teste ser planejado para este item. Reverificado em 2026-09-18 com a mesma busca (`websocket`/`broadcast`/`pusher`/`reverb`/`echo`) em `backend/app`, `backend/Modules`, `backend/routes`, `backend/config` e `frontend/src`: o único resultado é `backend/config/modules.php` (caminho do gerador de canais do `nwidart/laravel-modules`), falso positivo. |
| CRZ-06 | Navegação por papel | E2E | Operador comum que acessa diretamente a URL de gestão de operadores ou de logs é redirecionado ao painel | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("operador comum é redirecionado ao painel se acessar diretamente a gestão de operadores ou os logs") | Guarda de rota do frontend (`requiresAdminMaster` em `frontend/src/router/index.js`); o teste já existia, mas nenhum cenário o descrevia (CRZ-04 só fala de menu). |

## Visão geral de cobertura

| Status | Usuarios | Resgates | Cross-module | Total |
|---|---|---|---|---|
| Implementado | 57 | 79 | 5 | 141 |
| Planejado | 0 | 0 | 0 | 0 |
| Não coberto | 6 | 20 | 0 | 26 |
| Não implementado | 1 | 0 | 1 | 2 |
| **Total de cenários** | **64** | **99** | **6** | **169** |

> Esta tabela é um retrato do momento em que o test plan foi escrito/atualizado pela
> última vez — não é gerada automaticamente. Ao editar qualquer cenário em `usuarios.md`
> ou `resgates.md` que mude de status, atualize também esta contagem (ver convenção de
> manutenção em [`index.md`](./index.md)).
