# frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Testes E2E com Playwright

Pré-requisito: stack do projeto rodando (`docker compose up -d --build` na raiz).

```sh
make help              # lista todos os comandos disponíveis
make e2e-install       # uma vez, ou quando @playwright/test mudar de versão
make e2e               # reseta o banco (migrate:fresh --seed) e roda a suíte
make e2e-ui            # acompanhar rodando: abre http://localhost:9324 no navegador
make e2e-headed        # ou ver a janela real do Chromium (libera xhost sozinho)
make e2e-headed-slow   # igual acima, com pausa entre ações (padrão 500ms)
make e2e-report        # abre o relatório HTML da última execução
```

(Os mesmos comandos também existem como scripts `npm run test:e2e*`, caso prefira não
usar `make`.)

A suíte roda dentro da imagem oficial do Playwright via Docker (não no container Alpine
do frontend) — ver `frontend/.ai/rules/e2e-testing.md` para convenções, cobertura e o
porquê dessa escolha.
