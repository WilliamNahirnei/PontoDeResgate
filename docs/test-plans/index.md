# Índice de test plans

Documentos de planejamento e rastreabilidade de testes do PontoDeResgate — cobertura
**prospectiva completa** por funcionalidade, cenário a cenário, com base em
[`REQUISITOS.md`](../../REQUISITOS.md). Cada cenário listado tem um ID estável, uma
camada de teste, um status e, quando já existir, o caminho/nome do teste automatizado
real que o cobre. Cenários sem teste ainda também aparecem, para deixar explícito o que
falta cobrir — isto não é apenas um catálogo do que já existe.

Comece por [`integrado.md`](./integrado.md) para a visão geral, a matriz de
rastreabilidade por requisito e os fluxos que cruzam módulos. Os arquivos de módulo têm o
detalhe cenário a cenário de cada domínio de negócio.

| Arquivo | Escopo | Prefixo de ID |
|---|---|---|
| [`integrado.md`](./integrado.md) | Matriz de rastreabilidade consolidada, fluxos cross-module (Usuarios + Resgates), visão geral de cobertura | `CRZ-xx` |
| [`usuarios.md`](./usuarios.md) | Autenticação, papéis e gestão de operadores (módulo `backend/Modules/Usuarios`) | `USR-xx` |
| [`resgates.md`](./resgates.md) | Pedido de socorro, painel, gestão de status e auditoria (módulo `backend/Modules/Resgates`) | `RES-xx` |

## Convenções

- **Camadas de teste:**
  - `Unit` — testes isolados dentro do módulo (`backend/Modules/<Nome>/tests/Unit/`).
  - `Feature` — testes HTTP end-to-end do backend, centralizados em
    `backend/tests/Feature/` (é onde vivem inclusive os fluxos que cruzam módulos —
    ver convenção do projeto em `backend/.ai/rules/layered-architecture.md`).
  - `E2E` — testes de browser do frontend, em `frontend/e2e/tests/` (Playwright; ver
    `frontend/.ai/rules/e2e-testing.md`).
- **Status possíveis** (definidos com detalhe em `usuarios.md`/`resgates.md`):
  `Implementado` / `Planejado` / `Não coberto` / `Não implementado`.
- IDs são sequenciais e globais dentro de cada arquivo, nunca reciclados — permanecem
  estáveis como referência em PRs e commits mesmo que um cenário seja removido depois.
- Cenários que atravessam Usuarios e Resgates (o teste em si mistura os dois domínios,
  não apenas usa autenticação como pré-condição incidental) não aparecem nos arquivos de
  módulo — vivem só em `integrado.md`, prefixo `CRZ-xx`.

## Mantendo estes documentos atualizados

Ao escrever um teste automatizado novo (Unit, Feature ou E2E) para um cenário já listado
em algum destes arquivos, atualize a linha correspondente no mesmo PR: mude `Status` para
`Implementado` e preencha `Teste automatizado` com o caminho relativo (e o nome do
método/teste, quando útil para localizar rapidamente). Se o cenário ainda não existir na
tabela, adicione uma linha nova com o próximo ID sequencial do módulo — nunca reaproveite
um ID já usado por um cenário removido.

Revisar estes arquivos sempre que `REQUISITOS.md` mudar: todo requisito novo deveria
ganhar ao menos uma linha nova, com status `Não implementado` ou `Não coberto`, conforme
o caso.
