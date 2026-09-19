# Execução de testes — 2026-09-19 — E2E e exploratório dos cenários novos

> Relatório da skill `qa-executor`. Fase 1: suíte E2E completa contra os planos em
> [`docs/test-plans/`](../test-plans/index.md). Fase 2: exploração dos cenários `Não coberto` e
> `Não implementado` criados na revisão dos planos (commit `2c90b34`).

| Item | Valor |
|---|---|
| Data / início | 2026-09-19, ~11:20 (UTC-3) |
| Commit base | `2c90b34` (`main`) |
| Estado da árvore | **Suja**: testes Unit da sessão `backend-unit-tests-coverage` e as skills `qa-automator` e `qa-executor` ainda não commitados. Não alterados nesta execução |
| Ambiente | Stack de desenvolvimento no Docker: frontend `localhost:5183`, API `localhost:8180`, MySQL 8.4 (`3316`). Servidor de desenvolvimento do Vite, não build de produção |
| Playwright | `@playwright/test` 1.63.0, imagem `mcr.microsoft.com/playwright:v1.63.0-noble` |

## 1. Resumo

| Item | Resultado |
|---|---|
| Suíte E2E | **29 passaram, 0 falharam, 0 pulados, 0 flaky** (14,4 s) |
| Comando | `npm run test:e2e`, **com reset** do banco (`migrate:fresh --seed`), autorizado pelo usuário |
| Portas | As do `.env` da raiz batem com as que a suíte assume (5183 e 8180) |
| Exploração | 5 charters mais extras, com **scripts descartáveis** em Playwright 1.63 e contextos isolados |

**Desvio da skill:** o MCP do Playwright não abre navegador. `@playwright/mcp@latest` (0.0.82) traz
Playwright 1.64-alpha, que pede o Chromium 1246, e a imagem `v1.63.0` só tem o 1243. Por isso a
exploração foi roteirizada, não interativa (aprovado pelo usuário). Para consertar, é preciso fixar a
versão do `@playwright/mcp` no `.mcp.json`.

## 2. Falhas

Nenhuma.

## 3. Divergências com os planos

- Os 29 testes têm linha no plano, e as 27 linhas `Implementado` têm teste. Nada a corrigir em `Implementado`.
- Ajustes pedidos ao `qa-analyst`: **RES-119, RES-125, RES-118 e USR-61** (ver seção 5).

## 4. Achados exploratórios

Todos reproduzidos pelo menos 2 vezes.

### Alta

**A1. Dois operadores assumem o mesmo pedido ao mesmo tempo** (charter D)
- **Passos:** dois tokens de operador fazem `assume` no mesmo pedido pendente, em paralelo, 8 vezes.
- **Esperado:** um consegue e o outro recebe 409.
- **Obtido:** **8 de 8 rodadas** com 200 para os dois, **2 logs** `pendente→em_resgate` e o operador sobrescrito. Duas equipes despachadas para o mesmo pedido.
- **Oráculo:** `REQUISITOS.md` §4.2 fala em "o operador responsável", no singular. Coincide com a suspeita registrada antes sobre `RescueRequestService::assume` (status verificado fora da transação e sem lock).

**A2. Tela de logs quebra na página que contém um pedido apagado por soft delete** (charter E, RES-119)
- **Passos:** apagar por soft delete, via tinker, um pedido EXPLORATORIO com 2 logs. Abrir `/painel/logs` como admin master e paginar.
- **Obtido:** só a **página 3** falha (API 500, `Attempt to read property "id" on null`). A tela mostra "Não foi possível carregar os logs." e mantém as linhas da página 2 sob o rodapé "31-45 of 67". Os logs daquela página **ficam inacessíveis**. Depois de restaurar o pedido, as páginas 1 a 6 voltaram a 200.
- **Causa:** `RescueStatusLogRepository::paginateWithRelations` carrega `rescueRequest` sem `withTrashed()`, e `RescueStatusLogResource` lê `$this->rescueRequest->id`.
- **Oráculo:** §4.3 (soft delete e log de toda mudança). O pedido foi restaurado e nada ficou apagado.

### Média

**M1. Duplo clique em Assumir ou Concluir grava o log duas vezes**
- 4 de 4 tentativas (3 em Assumir, 1 em Concluir), sem erro. O botão não tem trava enquanto a requisição está em andamento.
- **Oráculo:** §4.3 (uma mudança, um registro). Mesma causa raiz do A1.

**M2. Ação de status que falha não dá nenhum retorno** (RES-118 confirmado)
- Cenários: assumir pedido já assumido por outro (409), concluir pedido já cancelado (409), cancelar com motivo de 1001 caracteres (422).
- **Obtido:** nada na tela. O card continua "Pendente" com o botão Assumir, o diálogo de cancelamento fica aberto e há `AxiosError` sem tratamento no console. Só "Atualizar" corrige a lista.
- **Oráculo:** já registrado no plano como `Não implementado`.

**M3. Homens, mulheres, crianças e idosos são coletados, mas o operador nunca os vê**
- O card mostra só total, animais e referência. O tooltip do mapa mostra só o total e a data.
- **Oráculo:** o plano (RES-125) diz que os dados aparecem no painel, mas `REQUISITOS.md` não define o que deve ser exibido. **Pergunta ao usuário:** a composição do grupo ajuda a priorizar, e hoje só serve como filtro.

**M4. Tela pública: quantidade muito grande derruba o envio com 500**
- Acima de 4.294.967.295 (`unsignedInteger`) o backend responde 500; reproduzido na tela e por `curl` em `total_people`, `men_count` e `animals_count`. Não há limite máximo: 2.147.483.648 e 4.294.967.295 são aceitos.
- Negativo, decimal e texto longo dão 422, mas a tela sempre mostra "Não foi possível enviar o pedido. Tente novamente.", sem dizer qual campo, e repetir não adianta.

**M5. Operador desativado com sessão aberta continua no painel** (USR-61)
- Após "Atualizar", a tela mostra "Não foi possível carregar os pedidos." (401) e não vai ao login. Um token adulterado no `localStorage` tem o mesmo efeito.
- **Comportamento não descrito** em `REQUISITOS.md`. Pergunta ao usuário: deveria ir ao login?

**M6. "Compartilhar localização" fica mudo sem `navigator.clipboard`**
- Sem `navigator.share`, e com `navigator.clipboard` ausente ou rejeitando a cópia, o clique não gera nenhum retorno. Isso acontece em implantação por HTTP puro. Simulado nos dois casos, não testado em produção. Com `navigator.share` disponível, funciona: chama o compartilhamento com a URL do Google Maps.

### Baixa

- **Textos em inglês na UI em português:** "The name field is required. (and 2 more errors)", "The password field must be at least 8 characters.", "The email has already been taken.", "The name field must not be greater than 255 characters.". A tela mostra só a primeira mensagem. A paginação também ("31-45 of 67", "Next page").
- **Sem página 404:** `/nao-existe` e `/painel/nao-existe` mostram tela em branco.
- **Filtro mínimo inválido** (`-1`, `1.5`): alerta genérico, e a lista antiga continua sem sinalizar que não está filtrada.
- **Filtro de nome com `%` traz todos** (curinga do `LIKE` não escapado).
- **Sem limite de tentativas:** 15 logins errados seguidos deram 422 sem nenhum 429, e 12 envios públicos seguidos deram 201. O requisito não fala disso.
- **Título da aba "Vite App"** em todas as telas. Precisa conferir no build de produção.
- **Botões dos cards no celular** têm 28 px de altura, abaixo do alvo de toque recomendado (44 px).
- **Papel forjado no `localStorage`** abre a estrutura das telas de admin para um operador; a API responde 403 e não vaza dados.
- **Marcadores empilhados:** 48 de 52 na mesma posição (efeito dos dados de teste, sem agrupamento no mapa).

### Confirmado sem problema

- **Papel × tela:** USR-70, 72, 73, 74, 79 e 80.
- **Gestão de operadores:** USR-76, 77 e 78 (lista só de operadores, em ordem alfabética, filtros combinados, botão "Novo operador").
- **Tela pública:** RES-79, 80, 81, 102 e 103, incluindo geolocalização negada ou ausente e falha de rede e 500 com dados preservados e reenvio funcionando.
- **Painel:** RES-109 a 117 e 122 a 124. Os seis filtros por categoria filtram a coluna certa. O mínimo 0 exclui quem não informou a quantidade. O mapa enquadra pedidos em São Paulo e Lisboa. A posição do marcador não muda após Atualizar, assumir ou filtrar.
- **Status com dois operadores:** RES-126 a 129, CRZ-10 e CRZ-11. Outro operador conclui e cancela; o log registra quem agiu; desativar um operador preserva seu nome no card e nos logs.
- **Robustez:** HTML injetado em nome, referência e operador não executa. O CORS só libera a origem configurada. Latitude e longitude nos limites (±90 e ±180) são aceitas e, fora deles, dão 422. O celular não tem rolagem horizontal. Não houve erro de console nas cargas.

## 5. Lacunas sugeridas ao `qa-analyst`

1. **E2E:** um duplo clique em Assumir ou Concluir gera uma única entrada na tela de logs (M1).
2. **E2E:** dois operadores clicam em Assumir ao mesmo tempo e só um consegue. É o cenário do A1, que hoje só existe como "página desatualizada" (RES-129).
3. **Ajustar RES-119:** só a página com o pedido apagado falha, e a tela mostra linhas antigas sob a paginação nova.
4. **Ajustar RES-125:** só total, animais e referência aparecem; as categorias não. Depende da resposta em M3.
5. **E2E:** o erro de validação do formulário público indica o problema, e quantidade fora da faixa não dá 500 (M4).
6. **E2E:** o cadastro de operador exibe mensagens de validação em português.
7. **E2E:** rota inexistente mostra uma página de "não encontrado".
8. **E2E:** "Compartilhar localização" sempre dá algum retorno.
9. Vinte e tantos cenários `Não coberto` foram verificados à mão e estão corretos. Quando o `qa-automator` escrever os specs, o comportamento esperado já está validado; os status seguem `Não coberto` até existir spec.

## 6. Não executado

- **Backend Unit e Feature:** o pedido foi só E2E e exploração.
- **Exploração interativa:** MCP do Playwright e Chrome real não foram usados.
- **Navegadores:** só Chromium headless. Firefox e WebKit não foram testados.
- **Ambiente:** só o servidor de desenvolvimento do Vite. O build de produção, HTTPS e mapas sem internet (os tiles vêm do OpenStreetMap) não foram testados.
- **Sem cobertura:** acessibilidade e teclado, iOS ou Android reais, desempenho e volume.
- **Race A1:** reproduzida por API concorrente, não por dois cliques simultâneos na tela.
- **Websocket (CRZ-05):** não implementado, então nada a executar.

## Dados e evidências

**Dados deixados no banco** (o reset foi autorizado, a limpeza não): 54 pedidos e 10 operadores com prefixo `EXPLORATORIO 2026-09-19`, sendo 2 operadores inativos, mais 68 logs no total. Não há endpoint de exclusão. Dois pedidos EXPLORATORIO têm quantidade absurda (2.147.483.648 e 4.294.967.295) e sempre aparecem no topo das ordenações por quantidade. Para limpar, `npm run test:e2e:reset` refaz o seed.

**Evidências**, versionadas em [`2026-09-19-e2e-e-exploratorio/`](./2026-09-19-e2e-e-exploratorio/LEIA-ME.md): 23 capturas de tela, o log e o relatório HTML da suíte E2E, as saídas dos scripts, os próprios scripts exploratórios e um guia que liga cada achado à sua evidência. As saídas dos scripts `a2`, `c2`, `d2`, `e`, `e2`, `f` e `debug-*` não foram gravadas em arquivo na hora: estão **transcritas do terminal** em `saidas/execucoes-complementares.txt`, e isso está dito no próprio arquivo.

Nenhum código, teste ou plano foi alterado pela execução.
