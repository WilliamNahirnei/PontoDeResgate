# CLAUDE.md

## O que é o projeto

PontoDeResgate é um sistema web para coordenar pedidos de socorro durante desastres de grande escala — tela pública de solicitação e painel autenticado para operadores. Para requisitos completos de produto, veja @REQUISITOS.md.

## Como rodar

```
docker compose up --build
```

Na raiz do monorepo, sobe os 3 serviços:
- Backend: `localhost:8000`
- Frontend: `localhost:5173`
- MySQL: `localhost:3306`

Se essas portas colidirem com outro projeto rodando na mesma máquina, sobrescreva
`BACKEND_PORT`/`FRONTEND_PORT`/`DB_PORT`/`VITE_API_BASE_URL` no `.env` da raiz (e
`VITE_API_BASE_URL` em `frontend/.env`, `APP_URL`/`CORS_ALLOWED_ORIGINS` em
`backend/.env`) — todos gitignored, é seguro ajustar por máquina sem afetar o time.

## Arquitetura

O sistema é composto por 3 serviços — backend (Laravel + Nginx + PHP-FPM via Supervisor), banco (MySQL) e frontend (Vue + Vuetify) — projetados para rodar em **servidores diferentes em produção**.

Não existe rede Docker interna entre os serviços nem comunicação por nome de serviço: toda comunicação acontece via variável de ambiente (host/porta/URL pública), com CORS configurável via `CORS_ALLOWED_ORIGINS` no backend.

Mesmo em desenvolvimento, o `docker-compose.yml` simula esse cenário usando portas publicadas no host em vez de um hostname interno do Compose.

## Convenções técnicas

- Autenticação por Bearer token via Laravel Sanctum — não usa cookie/sessão.

## Armadilha conhecida

O Laravel Boost é dependência de dev, mas a imagem builda com `--no-dev`. Se o volume `backend_vendor` for recriado (ex.: `docker compose down -v`), é necessário rodar novamente:

```
docker compose exec backend composer install
```

## Arquitetura modular do backend

O backend organiza o código por domínio de negócio (não por tipo técnico), usando
`nwidart/laravel-modules`. As regras e exemplos estão em `backend/.ai/rules/` (arquivo
`modules-architecture.md`, indexado em `index.md`) — o próprio `backend/CLAUDE.md`
(gerado pelo Boost) já instrui a ler esse índice automaticamente antes de criar, mover
ou editar qualquer arquivo em `backend/app/` ou `backend/Modules/`.

## Convenções de código

Para convenções específicas de código Laravel (geradas pelo Boost), veja @backend/CLAUDE.md.

## Testes E2E (frontend)

Suíte automatizada com Playwright em `frontend/e2e/`, cobrindo os fluxos hoje verificados
manualmente em browser (login, pedido público de socorro, painel, etc.). Convenções e
motivação de arquitetura (por que roda via Docker com a imagem oficial do Playwright, não
no container Alpine do frontend) estão em `frontend/.ai/rules/e2e-testing.md`. Para rodar:

```
docker compose up -d --build
cd frontend && npm run test:e2e
```

## Test plans (QA)

Documentos de planejamento/rastreabilidade de **testes funcionais** — o comportamento do
sistema rodando, verificado em Playwright ou por exploração manual; cobertura prospectiva
completa por funcionalidade, cenário a cenário, com status (`Implementado`/`Planejado`/`Não
coberto`/`Não implementado`) e link para o spec Playwright real quando existir — estão
em `docs/test-plans/` (um arquivo por módulo de negócio, `usuarios.md`/`resgates.md`,
mais `integrado.md` com a matriz de rastreabilidade e os fluxos cross-module). Comece por
`docs/test-plans/index.md`. Testes Unit e de endpoint (Feature) do backend testam código e
**não entram nos planos**. Ao escrever um spec Playwright novo, atualize a linha
correspondente no mesmo PR (ver convenção documentada em `docs/test-plans/index.md`).
O histórico de execuções (relatórios e evidências de cada rodada de E2E e exploração) fica em
`docs/test-runs/`; comece por `docs/test-runs/README.md`.

## Ferramentas de automação de browser (Claude)

Duas ferramentas de browser coexistem, com papéis diferentes:
- **MCP `playwright`** (`.mcp.json`): navegador Chromium isolado e determinístico, usado
  para o Claude gerar/depurar specs Playwright automatizados (`frontend/e2e/`) sem
  depender do Chrome do usuário. Roda `@playwright/mcp` dentro da imagem oficial
  `mcr.microsoft.com/playwright` via `docker run` (não direto via `npx` no host) porque a
  versão de Node do host pode ser antiga demais para o `playwright-core` mais recente
  (ex.: falta `net.getDefaultAutoSelectFamilyAttemptTimeout`, adicionada só a partir do
  Node 18.18/19.8) — a imagem já traz um Node compatível e os browsers pré-instalados.
  Roda em modo **headed** (`DISPLAY` do host repassado via `-e DISPLAY -v
  /tmp/.X11-unix:/tmp/.X11-unix:ro`) para o navegador ficar visível durante a sessão.
- **`claude-in-chrome`**: continua sendo a ferramenta para verificação visual ad-hoc na
  sessão interativa do usuário, no Chrome real dele — mantém a diretriz de "usar a
  feature em um browser antes de reportar como concluído" para mudanças de UI.
