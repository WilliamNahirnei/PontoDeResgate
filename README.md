# PontoDeResgate

Sistema web para coordenar pedidos de socorro durante desastres de grande escala (enchentes, incêndios, terremotos e outros).

> ⚠️ **Prova de conceito.** Este projeto demonstra uma ideia e está aberto a feedback e contribuições. **Não foi avaliado para uso em emergências reais.** Antes de qualquer uso operacional, é preciso uma revisão própria de segurança, disponibilidade e privacidade dos dados.

## A ideia

Em um desastre, pedidos de socorro chegam por muitos canais ao mesmo tempo (redes sociais, mensagens, ligações) e se perdem. O PontoDeResgate propõe um fluxo simples:

1. **Quem precisa de ajuda** abre uma tela pública, sem cadastro, marca sua localização no mapa e envia o pedido. Todos os campos são opcionais, exceto a localização.
2. **Operadores** acompanham os pedidos em um painel autenticado, com lista, mapa, filtros e ordenação. Cada operador assume um pedido, e o sistema impede que dois assumam o mesmo.
3. **Voluntários**, acionados pelos operadores, fazem o resgate no local indicado.
4. Toda mudança de status fica registrada em um **log de auditoria**, com o operador responsável, a data e a hora, o motivo do cancelamento e a observação da conclusão.

O sistema não é específico a um tipo de desastre: cada implantação já está associada a um evento e ao contexto operacional dele.

## Funcionalidades

- Pedido de socorro público, com localização no mapa (inclusive pela geolocalização do navegador)
- Painel de operadores: lista paginada, mapa, filtros (incluindo "Meus pedidos") e ordenação
- Fluxo de status: pendente → em resgate → concluído, ou cancelado, com motivo e observação
- Aviso ao agir em pedido assumido por outro operador
- Log de operações para consulta do admin master
- Cadastro e gestão de operadores pelo admin master
- Interface 100% em português

**Ainda não implementado:** alertas em tempo real por websocket para os operadores quando entra um pedido novo (previsto em [`REQUISITOS.md`](REQUISITOS.md), seção 5). Contribuições são bem-vindas.

## Tecnologias

- **Backend:** Laravel 13, arquitetura modular (`nwidart/laravel-modules`), autenticação por Bearer token (Laravel Sanctum)
- **Frontend:** Vue 3, Vuetify e Leaflet (mapa)
- **Banco:** MySQL 8.4
- **Testes:** Playwright (E2E) e PHPUnit (Unit e Feature)

Os três serviços (backend, frontend e banco) foram pensados para rodar em **servidores diferentes** em produção. A comunicação entre eles é feita por variáveis de ambiente, com CORS configurável.

## Como rodar

Pré-requisito: Docker e Docker Compose.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend (API): <http://localhost:8000>
- MySQL: `localhost:3306`

Se as portas colidirem com outro projeto, ajuste `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT` e `VITE_API_BASE_URL` no `.env` da raiz (e `VITE_API_BASE_URL` em `frontend/.env`, `APP_URL` e `CORS_ALLOWED_ORIGINS` em `backend/.env`).

### Primeiro acesso ao painel

O seed cria um admin master **apenas para desenvolvimento**:

- E-mail: `admin@pontoderesgate.local`
- Senha: `password`

**Nunca use essas credenciais fora do ambiente local.** Troque-as antes de qualquer implantação.

## Testes

```bash
# Backend (Unit + Feature, usa SQLite em memória)
docker compose exec backend php artisan test

# E2E (atenção: recria o banco de desenvolvimento com migrate:fresh --seed)
docker compose up -d --build
cd frontend && npm run test:e2e
```

Os cenários de teste funcionais estão planejados e rastreados em [`docs/test-plans/`](docs/test-plans/index.md).

## Documentação

- [`REQUISITOS.md`](REQUISITOS.md): fonte de verdade das regras de negócio
- [`docs/test-plans/`](docs/test-plans/index.md): planos de teste e rastreabilidade com os requisitos
- [`docs/test-runs/`](docs/test-runs/README.md): histórico de execuções de teste

## Contribuindo

Feedback, issues e pull requests são bem-vindos. Antes de propor uma mudança de comportamento, veja [`REQUISITOS.md`](REQUISITOS.md): ele define o que o sistema deve fazer, e os testes partem dele.

Boas formas de começar:
- Implementar os alertas em tempo real (websocket)
- Proteger a tela pública contra abuso (limite de requisições, antispam)
- Documentar a criação do admin master em produção
- Traduzir ou adaptar o sistema para o contexto de uma defesa civil ou ONG

## Licença

[MIT](LICENSE)
