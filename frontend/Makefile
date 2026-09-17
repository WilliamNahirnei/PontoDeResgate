.DEFAULT_GOAL := help

.PHONY: help e2e e2e-reset e2e-install e2e-run e2e-ui e2e-headed e2e-headed-slow e2e-report

PW_SLOWMO ?= 1500

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

e2e: ## Reseta o banco (migrate:fresh --seed) e roda a suíte E2E headless
	npm run test:e2e

e2e-reset: ## Só reseta o banco de dados do backend, sem rodar testes
	npm run test:e2e:reset

e2e-install: ## Instala/atualiza dependências (rodar 1x, ou ao mudar @playwright/test)
	npm run test:e2e:install

e2e-run: ## Roda a suíte headless sem resetar o banco antes
	npm run test:e2e:run

e2e-ui: ## Abre o UI mode (acompanhe em http://localhost:9324)
	npm run test:e2e:ui

e2e-headed: ## Roda com o navegador visível na tela (libera xhost +local:docker antes)
	xhost +local:docker
	npm run test:e2e:headed

e2e-headed-slow: ## Igual e2e-headed, com pausa entre ações (padrão 1500ms; ex.: make e2e-headed-slow PW_SLOWMO=3000)
	xhost +local:docker
	PW_SLOWMO=$(PW_SLOWMO) npm run test:e2e:headed:slow

e2e-report: ## Abre o relatório HTML da última execução
	npm run test:e2e:report
