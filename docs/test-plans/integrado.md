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
| §1.1 Idioma (todas as mensagens em português) | Usuarios + Resgates | E2E | Implementado | USR-69, USR-81, USR-83–USR-86, RES-186–RES-189, CRZ-12 |
| §1.2 Endereços inexistentes | Usuarios + Resgates | E2E | Não implementado | CRZ-13–CRZ-17 |
| §2 Papéis de usuário / autenticação | Usuarios | E2E | Parcial — sessão aberta de operador desativado Não implementado (USR-61) | USR-18–USR-22, USR-61, USR-70, USR-79, USR-80 |
| §3 Tela pública de pedido | Resgates | E2E | Implementado | RES-14–RES-16, RES-79–RES-81, RES-102, RES-103, RES-125, RES-172–RES-181, RES-187 |
| §4.1 Visualização de pedidos (painel) | Resgates | E2E | Parcial — "Limpar filtros" voltando status e ordenação (RES-145) e rolagem da lista até o card (RES-149) Não implementados | RES-39–RES-45, RES-109–RES-115, RES-122–RES-124, RES-145–RES-153, RES-159–RES-161, RES-188 |
| §4.2 Gestão de status do pedido | Resgates | E2E | Parcial — observação ao concluir (diálogo, opcional, limite de 1000, card, negativos) Não implementada (RES-130–RES-141) | RES-58–RES-61, RES-99, RES-116–RES-118, RES-126–RES-141, RES-154, RES-155, RES-162–RES-168, RES-170, RES-171, RES-182–RES-185 |
| §4.3 Log de operações | Resgates + Usuarios | E2E | Implementado | RES-157, RES-158, RES-169, CRZ-10, CRZ-11 |
| §4.4 Consulta de logs de operações | Resgates + Usuarios | E2E | Parcial — observação da conclusão na entrada de log (RES-142–RES-144) Não implementada | RES-69, RES-120, RES-142–RES-144, RES-186, RES-189, CRZ-04, CRZ-06 |
| §4.5 Cadastro e gestão de operadores | Usuarios | E2E | Implementado | USR-54–USR-57, USR-69, USR-72–USR-86 |
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
| CRZ-12 | Idioma | E2E | Todas as telas (pública, login, painel, operadores e logs) são reconhecidas pelo navegador como escritas em português | Implementado | `frontend/e2e/tests/page-language.spec.ts` ("todas as telas são reconhecidas pelo navegador como escritas em português") | `REQUISITOS.md` §1.1 (2026-10-03). Percorre a tela pública, o login, o painel, a lista e o cadastro de operadores e os logs, conferindo que a página declara o idioma português. Atravessa os dois módulos por percorrer as telas de ambos. Corrigido em 2026-10-03 (achado "mensagens em inglês"). |
| CRZ-13 | Endereço inexistente | E2E | Visitante sem sessão que acessa um endereço inexistente fora da área do operador (ex.: `/nao-existe`) é levado à tela pública de solicitação de socorro | Não implementado | `frontend/e2e/tests/unknown-address.spec.ts` ("sem sessão, um endereço inexistente fora da área do operador leva à tela de pedido de socorro") | `REQUISITOS.md` §1.2 (2026-10-03, achado "sem página 404"). O teste confere o endereço final e o título da tela. Teste escrito antes da correção: hoje falha porque a página fica no endereço inexistente, em branco (procurado em `frontend/src/router/index.js`: só as seis rotas conhecidas). |
| CRZ-14 | Endereço inexistente | E2E | Visitante sem sessão que acessa um endereço inexistente dentro da área do operador (ex.: `/painel/nao-existe`) é levado à tela pública de solicitação de socorro, não ao login, e a tela não mostra nada da área do operador | Não implementado | `frontend/e2e/tests/unknown-address.spec.ts` ("sem sessão, um endereço inexistente dentro da área do operador leva à tela de pedido de socorro, não ao login") | `REQUISITOS.md` §1.2 (2026-10-03, achado "sem página 404"). Requisito negativo: o visitante não recebe indicação de que o endereço pertence à área do operador. Diferente de USR-20 e USR-70, em que telas que existem levam ao login. O teste confere o endereço final e o título da tela. Teste escrito antes da correção: hoje falha porque a página fica no endereço inexistente, em branco (procurado em `frontend/src/router/index.js`: só as seis rotas conhecidas). |
| CRZ-15 | Endereço inexistente | E2E | Operador logado que acessa um endereço inexistente fora da área do operador (ex.: `/nao-existe`) é levado ao painel | Não implementado | `frontend/e2e/tests/unknown-address.spec.ts` ("operador logado num endereço inexistente fora da área do operador é levado ao painel") | `REQUISITOS.md` §1.2 (2026-10-03, achado "sem página 404"). O teste confere o endereço final e o título da tela. Teste escrito antes da correção: hoje falha porque a página fica no endereço inexistente, em branco (procurado em `frontend/src/router/index.js`: só as seis rotas conhecidas). |
| CRZ-16 | Endereço inexistente | E2E | Operador logado que acessa um endereço inexistente dentro da área do operador (ex.: `/painel/nao-existe`) é levado ao painel | Não implementado | `frontend/e2e/tests/unknown-address.spec.ts` ("operador logado num endereço inexistente dentro da área do operador é levado ao painel") | `REQUISITOS.md` §1.2 (2026-10-03, achado "sem página 404"). O teste confere o endereço final e o título da tela. Teste escrito antes da correção: hoje falha porque a página fica no endereço inexistente, em branco (procurado em `frontend/src/router/index.js`: só as seis rotas conhecidas). |
| CRZ-17 | Endereço inexistente | E2E | Admin master logado que acessa um endereço inexistente, fora ou dentro da área do operador, é levado ao painel | Não implementado | `frontend/e2e/tests/unknown-address.spec.ts` ("admin master logado num endereço inexistente, fora ou dentro da área do operador, é levado ao painel") | `REQUISITOS.md` §1.2 (2026-10-03, achado "sem página 404"). O teste confere o endereço final e o título da tela. Teste escrito antes da correção: hoje falha porque a página fica no endereço inexistente, em branco (procurado em `frontend/src/router/index.js`: só as seis rotas conhecidas). |

## Visão geral de cobertura

| Status | Usuarios | Resgates | Cross-module | Total |
|---|---|---|---|---|
| Implementado | 26 | 83 | 6 | 115 |
| Planejado | 0 | 0 | 0 | 0 |
| Não coberto | 0 | 0 | 0 | 0 |
| Não implementado | 1 | 17 | 6 | 24 |
| **Total de cenários** | **27** | **100** | **12** | **139** |

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
> `Implementado`, e o do RES-146 também, junto com os novos RES-159 a RES-161. Em 2026-09-28 entraram RES-163 a RES-165 (limite do motivo do cancelamento): RES-165 passa e está `Implementado`; RES-163 e RES-164 tinham teste escrito antes da implementação. Ainda em 2026-09-28 a correção do achado M2 levou a `Implementado` RES-118, RES-129, RES-154, RES-155, RES-162, RES-163 e RES-164, com a suíte E2E completa passando (86 testes). Ainda em 2026-09-28 entraram RES-166 a RES-171 (ação em andamento e duplo clique, achado M1): RES-169 fica `Planejado`, porque a recusa da segunda tentativa já existe; os demais ficam `Não implementado` até o botão ficar indisponível durante a ação. No mesmo dia os seis ganharam teste: RES-169 passa e está `Implementado`; os de RES-166 a RES-168, RES-170 e RES-171 foram escritos antes da implementação e, ainda em 2026-09-28, a correção do achado M1 os levou a `Implementado`, com a suíte E2E completa passando (92 testes). Ainda em 2026-09-28 entraram RES-172 a RES-181 (limites dos campos do formulário público, achado M3): os que só afirmam a faixa válida ficam `Planejado` (RES-172, RES-177, RES-180, RES-181), porque a tela já aceita esses valores; os demais ficam `Não implementado`. No mesmo dia os dez ganharam teste: RES-172, RES-177, RES-180 e RES-181 passam e estão `Implementado`; os de RES-173 a RES-176, RES-178 e RES-179 foram escritos antes da implementação e, ainda em 2026-09-28, a correção do achado M3 os levou a `Implementado`, com a suíte E2E completa passando (102 testes). Em 2026-10-03 o requisito "Compartilhar localização" foi reescrito (achado M4): RES-99 foi invertido (a ação não usa mais o menu do dispositivo) e voltou a `Não implementado`, porque o código e o spec dele provam o comportamento antigo; entraram RES-182 a RES-185 (diálogo com o link quando a cópia falha), `Não implementado`. No mesmo dia o spec do RES-99 foi reescrito e RES-182 a RES-185 ganharam teste, escritos antes da correção: os cinco falham até a correção do achado M4. Ainda em 2026-10-03 a correção do achado M4 levou os cinco a `Implementado`; na suíte E2E completa (106 testes), 104 passaram e 2 estouraram o tempo de 30 segundos sem relação com o M4 (o teste instável do filtro por quantidade mínima e o de RES-118), e os dois passaram 3 de 3 isolados. Ainda em 2026-10-03 entrou `REQUISITOS.md` §1.1 (todas as mensagens em português) e o cadastro de operador em §4.5 ganhou os textos exatos de senha curta e e-mail repetido: USR-69 passou a exigir o texto exato e voltou a `Não implementado`; entraram USR-81 a USR-86, RES-186 a RES-189 e CRZ-12, todos `Não implementado`, exceto USR-82 (`Planejado`, a regra dos 8 caracteres já existe). No mesmo dia os doze ganharam teste: USR-82 passa e está `Implementado`; os demais foram escritos antes da correção e falham até ela, assim como os testes de paginação de USR-55 e RES-69, que passaram a clicar em "Próxima página". Ainda em 2026-10-03 a correção do achado "mensagens em inglês" levou os onze a `Implementado`; a suíte E2E completa, rodada com reset do banco, passou inteira (117 testes). Ainda em 2026-10-03 entrou `REQUISITOS.md` §1.2 (endereços inexistentes): CRZ-13 a CRZ-17, `Não implementado`; no mesmo dia ganharam teste, escrito antes da correção, que falha até ela.
