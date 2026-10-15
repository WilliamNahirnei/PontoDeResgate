# Índice de test plans

Documentos de planejamento e rastreabilidade dos **testes funcionais** do PontoDeResgate —
cobertura **prospectiva completa** do comportamento do sistema rodando, cenário a cenário,
com base em [`REQUISITOS.md`](../../REQUISITOS.md). Cada cenário tem um ID estável, uma
camada, um status e, quando existir, o spec Playwright que o cobre. Cenários sem teste
também aparecem, para deixar explícito o que falta cobrir — isto não é apenas um catálogo
do que já existe.

Comece por [`integrado.md`](./integrado.md) para a visão geral, a matriz de
rastreabilidade por requisito e os fluxos que cruzam módulos. Os arquivos de módulo têm o
detalhe cenário a cenário de cada domínio de negócio.

| Arquivo | Escopo | Prefixo de ID |
|---|---|---|
| [`integrado.md`](./integrado.md) | Matriz de rastreabilidade consolidada, fluxos cross-module (Usuarios + Resgates), visão geral de cobertura | `CRZ-xx` |
| [`usuarios.md`](./usuarios.md) | Autenticação, papéis e gestão de operadores | `USR-xx` |
| [`resgates.md`](./resgates.md) | Pedido de socorro, painel, gestão de status e auditoria | `RES-xx` |

## O que é (e o que não é) um test plan aqui

O plano descreve o que o sistema **faz para quem o usa**, verificado **com o sistema
rodando**: em Playwright (automatizado) ou por exploração manual.

**Fora do plano:** testes Unit (`backend/Modules/<Nome>/tests/Unit/`) e testes de endpoint
(`backend/tests/Feature/`). Eles testam código, vivem no backend e não ganham linha aqui,
não entram na contagem de cobertura e não contam como "Implementado" de nenhum cenário.
Uma regra que só se prova chamando um endpoint ou uma classe não é cenário deste plano.

## Convenções

- **Camadas:**
  - `E2E` — cenário verificável pela interface, automatizado (ou a automatizar) em
    Playwright, em `frontend/e2e/tests/` (ver `frontend/.ai/rules/e2e-testing.md`).
  - `Exploratório` — cenário que exige algo fora da interface (ex.: manipular o banco) ou
    que só faz sentido explorar à mão; verificado com o sistema rodando, sem spec.
  - `—` — funcionalidade que não existe no código (só com status `Não implementado`).
- **Status possíveis:** `Implementado` (existe spec Playwright e foi visto passando) /
  `Planejado` / `Não coberto` / `Não implementado`. A definição completa está na legenda de
  `usuarios.md` e `resgates.md`.
- IDs são sequenciais e globais dentro de cada arquivo, nunca reciclados — permanecem
  estáveis como referência em PRs e commits mesmo que um cenário seja removido depois.
  Próximos IDs livres: `USR-87`, `RES-196`, `CRZ-19`.
- **IDs aposentados:** até 2026-09-18 os planos também listavam testes Unit e Feature. Essas
  linhas foram removidas em 2026-09-19 e seus IDs não são reaproveitados (por isso a
  numeração tem lacunas). O histórico está no commit `dd9807f`. `RES-119` (tela de logs com
  pedido apagado por soft delete) foi aposentado em 2026-09-23: `REQUISITOS.md` §7 passou a
  dizer que nenhum pedido é excluído do sistema.
- Cenários que atravessam Usuarios e Resgates (a checagem em si mistura os dois domínios,
  não apenas usa autenticação como pré-condição incidental) não aparecem nos arquivos de
  módulo — vivem só em `integrado.md`, prefixo `CRZ-xx`.

## Mantendo estes documentos atualizados

Ao escrever um spec Playwright novo para um cenário já listado em algum destes arquivos,
atualize a linha correspondente no mesmo PR: mude `Status` para `Implementado` (depois de
vê-lo passar) e preencha `Teste automatizado` com o caminho relativo e o título do teste.
Se o cenário ainda não existir na tabela, adicione uma linha nova com o próximo ID
sequencial do arquivo — nunca reaproveite um ID já usado por um cenário removido.

Revisar estes arquivos sempre que `REQUISITOS.md` mudar: todo requisito novo deveria
ganhar ao menos uma linha nova, com status `Não implementado` ou `Não coberto`, conforme
o caso. Escrever ou alterar teste Unit ou Feature **não** exige mexer aqui.
