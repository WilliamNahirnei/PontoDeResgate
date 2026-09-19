# Evidências — execução de 2026-09-19

Material que sustenta o relatório [`../2026-09-19-e2e-e-exploratorio.md`](../2026-09-19-e2e-e-exploratorio.md).

## Conteúdo

| Pasta | O que há |
|---|---|
| `screenshots/` | 23 capturas de tela dos achados e dos cenários verificados |
| `saidas/` | Log e relatório HTML da suíte E2E, saídas dos charters A a D, ids dos dados do charter D e as saídas complementares |
| `scripts/` | Os scripts exploratórios descartáveis (Playwright 1.63) e o `run.sh` que os executa |

## Achado → evidência

| Achado (relatório, seção 4) | Capturas | Saída / script |
|---|---|---|
| A1. Dois operadores assumem o mesmo pedido | — | `saidas/charter-d.out` (linha `RES-96`), `scripts/charter-d.cjs` |
| A2. Tela de logs quebra com pedido apagado (RES-119) | `res119-logs-pagina-quebrada.png`, `res119-logs-quebrada.png` (esta é a 1ª tentativa, página sem falha) | `saidas/execucoes-complementares.txt` item 5, `scripts/charter-e2.cjs` |
| M1. Duplo clique grava log duplicado | — | `saidas/charter-d.out` (`D-duplo-clique`), `saidas/execucoes-complementares.txt` item 4, `scripts/charter-d2.cjs` |
| M2. Ação de status que falha sem retorno (RES-118) | `res118-assumir-conflito.png`, `d-motivo-longo.png` | `saidas/charter-d.out` |
| M3. Categorias não aparecem no painel (RES-125) | `res125-card-painel.png` | `saidas/charter-b.out` (`RES-125`) |
| M4. Quantidade enorme dá 500 e erros genéricos | — | `saidas/charter-b.out` (`B-hostil`), `saidas/execucoes-complementares.txt` item 7 |
| M5. Desativado com sessão aberta (USR-61) | `usr61-desativado-sessao-aberta.png`, `extra-token-adulterado.png` | `saidas/charter-a.out` |
| M6. Compartilhar sem retorno | — | `saidas/charter-c.out` (`RES-99`, `EXTRA/compartilhar-*`) |
| Textos em inglês | `usr69-email-duplicado.png`, `usr75-senha-fraca.png` | `saidas/charter-a.out` |
| Sem página 404 | `f-rota-inexistente-nao-existe.png`, `f-rota-inexistente-painel-nao-existe.png` | `saidas/execucoes-complementares.txt` item 6 |
| Filtro mínimo inválido | `extra-filtro-negativo.png` | `saidas/charter-c.out` |
| Papel forjado no `localStorage` | `extra-papel-adulterado.png` | `saidas/charter-a.out` |
| Celular | `b-mobile.png`, `c-mobile-painel.png`, `d-mobile-cards.png` | `saidas/charter-{b,c,d}.out` |
| Cenários confirmados | `res81-pin-ajustado.png`, `res103-*.png`, `res111-selecao.png`, `res113-enquadramento.png`, `crz10-logs.png`, `usr72-desativado-login.png` | `saidas/charter-*.out` |

## Fase 1 (suíte E2E)

- `saidas/e2e-suite.log`: saída do `npm run test:e2e` (reset do banco e 29 testes, 29 passaram, 14,4 s).
- `saidas/playwright-report.html`: relatório HTML do Playwright, arquivo único. Abra no navegador.

## Como reexecutar os scripts

```bash
cd docs/test-runs/2026-09-19-e2e-e-exploratorio/scripts
./run.sh charter-a.cjs      # idem b, c, d, e2, f
```

Requisitos e cuidados:

- A stack precisa estar de pé em `localhost:5183` (frontend) e `localhost:8180` (API), e o banco tem de
  estar como depois de `npm run test:e2e:reset` (o admin do seed `admin@pontoderesgate.local` / `password`).
- **Os scripts criam dados** (pedidos e operadores com o prefixo `EXPLORATORIO 2026-09-19`) e não os apagam:
  não há endpoint de exclusão. O `charter-d.cjs` também desativa operadores criados por ele.
- O prefixo dos dados criados vem de `TAG` em `scripts/lib.cjs`; troque a data numa nova rodada, para
  distinguir os dados de cada execução.
- **RES-119 não é totalmente automático:** o apagar e restaurar por soft delete é feito por
  `docker compose exec backend php artisan tinker`. Os comandos estão em
  `saidas/execucoes-complementares.txt` (item 5); `charter-e.cjs` e `charter-e2.cjs` só observam.
  Enquanto o pedido estiver apagado, a tela de logs quebra para todos: restaure logo depois.
- As capturas geradas em novas execuções vão para `scripts/shots/`, ignorada pelo git.
- Os scripts são descartáveis, escritos para uma exploração pontual: não são specs e não substituem
  `frontend/e2e/`. Para virar teste automatizado, use a skill `qa-automator`.

## Por que scripts e não o MCP do Playwright

O MCP não abriu navegador: `@playwright/mcp@latest` (0.0.82) exige o Chromium 1246 e a imagem
`v1.63.0-noble` só tem o 1243. Ver relatório, seção 1.
