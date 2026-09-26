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
| §2 Papéis de usuário / autenticação | Usuarios | E2E | Parcial — sessão aberta de operador desativado Não implementado (USR-61) | USR-18–USR-22, USR-61, USR-70, USR-79, USR-80 |
| §3 Tela pública de pedido | Resgates | E2E | Implementado | RES-14–RES-16, RES-79–RES-81, RES-102, RES-103, RES-125 |
| §4.1 Visualização de pedidos (painel) | Resgates | E2E | Parcial — "Limpar filtros" voltando status e ordenação (RES-145) e rolagem da lista até o card (RES-149) Não implementados | RES-39–RES-45, RES-109–RES-115, RES-122–RES-124, RES-145–RES-153, RES-159–RES-161 |
| §4.2 Gestão de status do pedido | Resgates | E2E | Parcial — concorrência entre operadores (mensagem de erro, atualização do painel, nome não exposto, diálogo fechado) Não implementada (RES-118, RES-129, RES-154, RES-155, RES-162); observação ao concluir (diálogo, opcional, limite de 1000, card, negativos) Não implementada (RES-130–RES-141) | RES-58–RES-61, RES-99, RES-116–RES-118, RES-126–RES-141, RES-154, RES-155, RES-162 |
| §4.3 Log de operações | Resgates + Usuarios | E2E | Implementado | RES-157, RES-158, CRZ-10, CRZ-11 |
| §4.4 Consulta de logs de operações | Resgates + Usuarios | E2E | Parcial — observação da conclusão na entrada de log (RES-142–RES-144) Não implementada | RES-69, RES-120, RES-142–RES-144, CRZ-04, CRZ-06 |
| §4.5 Cadastro e gestão de operadores | Usuarios | E2E | Implementado | USR-54–USR-57, USR-69, USR-72–USR-78 |
| §7 Status de um pedido (nenhum pedido é excluído) | Resgates | E2E | Implementado | RES-116, RES-156 |
| §5 Alertas em tempo real (websocket) | Resgates + Usuarios | — | Não implementado / não confirmado | CRZ-05 |
| §9 Ambiente de desenvolvimento (admin master semeado) | Usuarios | E2E | Coberto de forma implícita: o login de USR-18 usa as credenciais do seed | USR-18 |
| Navegação condicional por papel (menus e rotas exclusivos de admin master) | Usuarios + Resgates | E2E | Implementado | USR-57, CRZ-04, CRZ-06 |
| Fluxo completo do painel | Usuarios + Resgates | E2E | Implementado | CRZ-03 |

## Fluxos cross-module

| ID | Fluxo | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| CRZ-03 | Painel completo | E2E | Login como operador → visualizar, filtrar, assumir e cancelar um pedido, ponta a ponta | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("fluxo completo do painel: operador visualiza, filtra, assume e cancela um pedido") |  |
| CRZ-04 | Navegação por papel | E2E | Admin master vê os itens de menu de gestão de operadores e de logs; operador comum não vê nenhum dos dois | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("admin master vê os itens de menu de gestão de operadores e de logs", "operador comum não vê os itens de menu de gestão de operadores nem de logs") | A metade negativa foi reescrita em 2026-09-24 (ver USR-57). |
| CRZ-05 | Alertas em tempo real | — | Operadores conectados recebem um alerta via websocket quando um novo pedido é criado (`REQUISITOS.md` §5) | Não implementado | — | Nenhum código (`websocket`/`broadcast`/`pusher`/`reverb`) nem teste correspondente foi localizado em backend ou frontend. Precisa de uma investigação/confirmação de escopo antes de qualquer teste ser planejado para este item. Reverificado em 2026-09-18 com a mesma busca (`websocket`/`broadcast`/`pusher`/`reverb`/`echo`) em `backend/app`, `backend/Modules`, `backend/routes`, `backend/config` e `frontend/src`: o único resultado é `backend/config/modules.php` (caminho do gerador de canais do `nwidart/laravel-modules`), falso positivo. |
| CRZ-06 | Navegação por papel | E2E | Operador comum que acessa diretamente a URL de gestão de operadores ou de logs é redirecionado ao painel | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("operador comum é redirecionado ao painel se acessar diretamente a gestão de operadores ou os logs") | Guarda de rota do frontend (`requiresAdminMaster` em `frontend/src/router/index.js`); o teste já existia, mas nenhum cenário o descrevia (CRZ-04 só fala de menu). |
| CRZ-10 | Auditoria (operador × log) | E2E | Depois de um operador assumir, concluir ou cancelar pedidos pela UI, o admin master vê na tela de logs uma entrada para cada mudança, com o operador que agiu e a transição de status correta | Implementado | `frontend/e2e/tests/rescue-status-logs.spec.ts` ("depois de um operador assumir, concluir e cancelar pela UI, o admin master vê cada mudança nos logs com o operador que agiu") | Duas sessões: o operador age num contexto de navegador e o admin master confere os logs em outro. |
| CRZ-11 | Operadores × histórico | E2E | Desativar um operador que já atendeu pedidos não apaga o histórico: o card do pedido continua mostrando o operador responsável e a tela de logs continua listando as entradas dele | Implementado | `frontend/e2e/tests/rescue-status-logs.spec.ts` ("desativar um operador que já atendeu pedidos não apaga o histórico no card nem na tela de logs") | |

## Visão geral de cobertura

| Status | Usuarios | Resgates | Cross-module | Total |
|---|---|---|---|---|
| Implementado | 20 | 51 | 5 | 76 |
| Planejado | 0 | 0 | 0 | 0 |
| Não coberto | 0 | 0 | 0 | 0 |
| Não implementado | 1 | 22 | 1 | 24 |
| **Total de cenários** | **21** | **73** | **6** | **100** |

> Esta tabela é um retrato do momento em que o test plan foi escrito/atualizado pela
> última vez — não é gerada automaticamente. Ao editar qualquer cenário em `usuarios.md`
> ou `resgates.md` que mude de status, atualize também esta contagem (ver convenção de
> manutenção em [`index.md`](./index.md)). "Implementado" significa que existe spec
> Playwright e foi visto passando. Em 2026-09-24 cada cenário `Implementado` foi executado
> isoladamente, com o banco recriado do zero (`migrate:fresh --seed`) antes de cada um, e
> conferido contra a linha do plano; os que falharam ou não provavam o cenário tiveram o
> teste apagado e voltaram a `Planejado` (USR-21, USR-55, USR-57, RES-40, CRZ-04); no mesmo dia
> os cinco foram reescritos e voltaram a `Implementado`. Ainda em 2026-09-24 os 46 cenários
> `Não coberto` ganharam teste; 44 passam e 2 falham por bug (RES-125, RES-146), e por isso
> continuam `Não coberto`. Em 2026-09-26 o bug do RES-125 foi corrigido e ele passou a
> `Implementado`, e o do RES-146 também, junto com os novos RES-159 a RES-161.
