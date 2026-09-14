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

## Convenções de código

Para convenções específicas de código Laravel (geradas pelo Boost), veja @backend/CLAUDE.md.
