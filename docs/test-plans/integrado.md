# Test plan — Visão integrada

> Matriz de rastreabilidade consolidada e fluxos cross-module (Usuarios + Resgates). Não
> duplica cenários dos arquivos de módulo — referencia-os pelo ID. Este plano cobre só
> testes funcionais do sistema rodando (Playwright ou exploratório); testes Unit e de
> endpoint do backend não entram aqui. Cenários exclusivamente cross-module (cuja checagem,
> em si, depende dos dois domínios) vivem só aqui, prefixo `CRZ-xx`.

## Como este arquivo se relaciona com os arquivos de módulo

- [`usuarios.md`](./usuarios.md) e [`resgates.md`](./resgates.md) são a fonte de verdade
  cenário a cenário de cada módulo.
- Este arquivo referencia esses cenários pelo ID (ex.: "USR-18") sem repetir a descrição —
  ao atualizar um cenário, edite apenas o arquivo de módulo correspondente.
- Um cenário só ganha ID próprio aqui (`CRZ-xx`) quando a própria checagem que ele faz
  depende dos dois domínios ao mesmo tempo — por exemplo, "o admin master vê na tela de logs
  o operador que agiu" mistura o papel de Usuarios com o dado de Resgates. Um teste que apenas
  *usa* um operador autenticado como pré-condição para exercitar uma regra que é, em si, só
  de Resgates (ex.: assumir um pedido) fica no arquivo de módulo, não aqui.

## Matriz de rastreabilidade (requisito → módulo → camada → status)

| Requisito (`REQUISITOS.md`) | Módulo(s) | Camadas | Status geral | Cenários |
|---|---|---|---|---|
| §2 Papéis de usuário / autenticação | Usuarios | E2E | Parcial — visitante nas rotas de admin (USR-70), voltar após logout (USR-79) e sessão após recarregar (USR-80) Não coberto; sessão aberta de operador desativado Não implementado (USR-61) | USR-18–USR-22, USR-61, USR-70, USR-79, USR-80 |
| §3 Tela pública de pedido | Resgates | E2E | Parcial — requisito negativo do painel (RES-79), geolocalização negada (RES-80), ajuste do pin (RES-81), pós-envio (RES-102), falha no envio (RES-103) e dados chegando ao painel (RES-125) Não coberto | RES-14–RES-16, RES-79–RES-81, RES-102, RES-103, RES-125 |
| §4.1 Visualização de pedidos (painel) | Resgates | E2E | Parcial — reflexo no mapa, enquadramento, não-reposicionamento, ordenação por data/hora e filtros por categoria Não cobertos. Requisito × implementação divergem em "lista alternativa ao mapa", ver RES-41 | RES-39–RES-45, RES-109–RES-115, RES-122–RES-124 |
| §4.2 Gestão de status do pedido | Resgates | E2E | Parcial — cancelar em atendimento, operador diferente, página desatualizada, botões por status, operador no card e `navigator.share` Não cobertos; falha de ação sem feedback Não implementado (RES-118) | RES-58–RES-61, RES-99, RES-116–RES-118, RES-126–RES-129 |
| §4.3 Auditoria | Resgates + Usuarios | E2E, Exploratório | Parcial — ação pela UI → log com operador correto (CRZ-10) e histórico após desativação (CRZ-11) Não cobertos; **tela de logs quebra com pedido apagado por soft delete, bug confirmado (RES-119)** | RES-119, CRZ-10, CRZ-11 |
| §4.4 Cadastro e gestão de operadores | Usuarios | E2E | Parcial — desativado não entra (USR-72), reativado volta (USR-73), novo operador entra (USR-74), validação do cadastro (USR-75), conteúdo/filtros/botão da lista (USR-76–USR-78) e erro de e-mail duplicado (USR-69) Não cobertos | USR-54–USR-57, USR-69, USR-72–USR-78 |
| §4.5 Consulta de logs de operações | Resgates + Usuarios | E2E | Parcial — operador e data/hora na tela (RES-120) Não coberto | RES-69, RES-120, CRZ-04, CRZ-06 |
| §5 Alertas em tempo real (websocket) | Resgates + Usuarios | — | Não implementado / não confirmado | CRZ-05 |
| §9 Ambiente de desenvolvimento (admin master semeado) | Usuarios | E2E | Coberto de forma implícita: o login de USR-18 usa as credenciais do seed | USR-18 |
| Navegação condicional por papel (menus e rotas exclusivos de admin master) | Usuarios + Resgates | E2E | Implementado | USR-57, CRZ-04, CRZ-06 |
| Fluxo completo do painel | Usuarios + Resgates | E2E | Implementado | CRZ-03 |

## Fluxos cross-module

| ID | Fluxo | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| CRZ-03 | Painel completo | E2E | Login como operador → visualizar, filtrar, assumir e cancelar um pedido, ponta a ponta | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("fluxo completo do painel: operador visualiza, filtra, assume e cancela um pedido") |  |
| CRZ-04 | Navegação por papel | E2E | Admin master vê os itens de menu de gestão de operadores e de logs; operador comum não vê nenhum dos dois | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("admin master vê os itens de menu de gestão de operadores e de logs", "operador comum não vê os itens de menu de gestão de operadores nem de logs") |  |
| CRZ-05 | Alertas em tempo real | — | Operadores conectados recebem um alerta via websocket quando um novo pedido é criado (`REQUISITOS.md` §5) | Não implementado | — | Nenhum código (`websocket`/`broadcast`/`pusher`/`reverb`) nem teste correspondente foi localizado em backend ou frontend. Precisa de uma investigação/confirmação de escopo antes de qualquer teste ser planejado para este item. Reverificado em 2026-09-18 com a mesma busca (`websocket`/`broadcast`/`pusher`/`reverb`/`echo`) em `backend/app`, `backend/Modules`, `backend/routes`, `backend/config` e `frontend/src`: o único resultado é `backend/config/modules.php` (caminho do gerador de canais do `nwidart/laravel-modules`), falso positivo. |
| CRZ-06 | Navegação por papel | E2E | Operador comum que acessa diretamente a URL de gestão de operadores ou de logs é redirecionado ao painel | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("operador comum é redirecionado ao painel se acessar diretamente a gestão de operadores ou os logs") | Guarda de rota do frontend (`requiresAdminMaster` em `frontend/src/router/index.js`); o teste já existia, mas nenhum cenário o descrevia (CRZ-04 só fala de menu). |
| CRZ-10 | Auditoria (operador × log) | E2E | Depois de um operador assumir, concluir ou cancelar pedidos pela UI, o admin master vê na tela de logs uma entrada para cada mudança, com o operador que agiu e a transição de status correta | Não coberto | — | `REQUISITOS.md` §4.3. RES-69 cria a mudança por API e só confere pedido e status; o operador não é conferido e o caminho ação pela UI → log não é exercitado. Exige duas sessões (operador e admin master). |
| CRZ-11 | Operadores × histórico | E2E | Desativar um operador que já atendeu pedidos não apaga o histórico: o card do pedido continua mostrando o operador responsável e a tela de logs continua listando as entradas dele | Não coberto | — | Integridade entre Usuarios e Resgates (`REQUISITOS.md` §4.2, §4.3 e §4.4). |

## Visão geral de cobertura

| Status | Usuarios | Resgates | Cross-module | Total |
|---|---|---|---|---|
| Implementado | 9 | 15 | 3 | 27 |
| Planejado | 0 | 0 | 0 | 0 |
| Não coberto | 11 | 25 | 2 | 38 |
| Não implementado | 1 | 1 | 1 | 3 |
| **Total de cenários** | **21** | **41** | **6** | **68** |

> Esta tabela é um retrato do momento em que o test plan foi escrito/atualizado pela
> última vez — não é gerada automaticamente. Ao editar qualquer cenário em `usuarios.md`
> ou `resgates.md` que mude de status, atualize também esta contagem (ver convenção de
> manutenção em [`index.md`](./index.md)). "Implementado" significa que existe spec
> Playwright; a última execução completa da suíte E2E **não foi refeita** na revisão de
> 2026-09-19.
