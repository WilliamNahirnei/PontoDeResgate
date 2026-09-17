# Testes E2E com Playwright

Este documento descreve como a suíte de testes end-to-end (E2E) do frontend está
organizada, por que ela roda do jeito que roda, e as convenções a seguir ao adicionar
novos testes.

## Por que roda via Docker (imagem oficial do Playwright), não localmente

O frontend exige Node `^22.18.0 || >=24.12.0` (`frontend/package.json` → `engines`) e o
build/dev container do projeto usa `node:22-alpine` (`frontend/Dockerfile`). O Playwright
não é oficialmente suportado rodando *browsers* em Alpine (musl libc) — instalar
`@playwright/test` e rodar `npm run dev` no Alpine funciona bem, mas baixar e executar o
Chromium dentro desse mesmo container é frágil.

Por isso a suíte E2E roda dentro da imagem oficial `mcr.microsoft.com/playwright` (base
Debian/Ubuntu, com os browsers já pré-instalados na versão exata da tag), não dentro do
container `frontend` do `docker-compose.yml` nem diretamente na máquina do
desenvolvedor (que pode ter uma versão de Node diferente da exigida pelo projeto). A tag
da imagem Docker deve sempre acompanhar a versão instalada de `@playwright/test` em
`frontend/package.json` (ex.: `@playwright/test@1.63.0` → imagem
`mcr.microsoft.com/playwright:v1.63.0-noble`) — uma versão desalinhada entre o pacote npm
e a imagem causa erros de "browser not found"/incompatibilidade de protocolo.

O container da suíte roda com `--network host` (Linux) para falar diretamente com
`http://localhost:<FRONTEND_PORT>` e `http://localhost:<BACKEND_PORT>` — as mesmas portas
publicadas pelo `docker compose up` do projeto —, sem precisar descobrir nome de serviço
nem IP de rede Docker.

## Como rodar

Pré-requisito: stack do projeto de pé (`docker compose up -d --build` na raiz).

```bash
cd frontend
make e2e-install   # uma vez, ou sempre que @playwright/test mudar de versão
make e2e           # reseta o banco (migrate:fresh --seed) e roda a suíte
make e2e-report    # abre o relatório HTML (trace/screenshot/video em falha)
```

`make help` lista todos os targets. Cada target só chama o script `npm run test:e2e*`
correspondente (o `Makefile` existe por conveniência de digitação/descoberta via `make
help`, não duplica lógica — quem quiser pode usar os scripts `npm run` diretamente).

`test:e2e:install`, `test:e2e:run` e `test:e2e:report` disparam `docker run` com a imagem
oficial do Playwright; `test:e2e:reset` roda `php artisan migrate:fresh --seed` via
`docker compose exec` diretamente no host (por isso ele NÃO está dentro de um
`globalSetup` do `playwright.config.ts`: o container efêmero do Playwright não tem acesso
ao Docker CLI/socket do host, então o reset de banco precisa ser um passo do lado de fora,
orquestrado pelos scripts do `package.json`, antes de subir o container de teste).

Se `E2E_BASE_URL`/`E2E_API_BASE_URL` não forem passados, os scripts assumem as portas
atuais do `.env` local do projeto — se você mudar `FRONTEND_PORT`/`BACKEND_PORT` no
`.env` da raiz, atualize também esses defaults em `frontend/playwright.config.ts` e
`frontend/e2e/fixtures/auth.ts` (ou exporte as env vars correspondentes antes de rodar).

### Ver os testes rodando

**UI mode (`npm run test:e2e:ui`) — recomendado.** Sobe o container com
`--ui-host=127.0.0.1 --ui-port=9324` e você abre `http://localhost:9324` no seu
navegador para acompanhar a execução (linha do tempo, DOM, rede, console) em tempo real.
Não exige nenhuma configuração de display — a interface é servida via HTTP, então
funciona igual em qualquer máquina/sessão (inclusive remota via SSH).

**Headed (`make e2e-headed`) — janela real do Chromium.** Abre o navegador de verdade na
sua tela, repassando o `$DISPLAY`/socket X11 do host para o container. O target do
`Makefile` já roda `xhost +local:docker` antes (necessário para o X server aceitar
conexões de containers locais); reverta com `xhost -local:docker` se quiser fechar essa
permissão depois. Se `xhost` não existir/estiver bloqueado (ex.: sessão sem X11,
servidor remoto, Wayland puro), use o UI mode acima em vez disso — ele não depende de
X11.

Cada teste roda rápido (~1s), então o navegador pode abrir/fechar rápido demais para
acompanhar. Use `make e2e-headed-slow` (padrão 1500ms de pausa entre ações; ajuste com
`make e2e-headed-slow PW_SLOWMO=3000` para mais lento ainda) — controlado pela env var
`PW_SLOWMO` (ms), lida em `playwright.config.ts` (`use.launchOptions.slowMo`).

O container do modo headed roda como `root` (precisa ser root para acessar o socket X11
sem problema de permissão), então `playwright-report/`/`test-results/` ficam com esse
dono ao final. `frontend/e2e/scripts/fix-report-ownership.sh` corrige isso
automaticamente logo depois de `test:e2e:headed`/`test:e2e:headed:slow` — sem isso, a
próxima execução headless (`test:e2e`/`test:e2e:run`, que roda como o usuário local)
falharia com `EACCES`.

Rodar headed/UI mode diretamente no host (fora do Docker) exigiria uma versão de Node
compatível com o `engines` do projeto (nvm/fnm) — não recomendado por enquanto, ver
seção acima sobre por que a suíte roda via Docker.

## Cobertura e prioridade

Todos os fluxos abaixo já têm spec (rastreabilidade cenário a cenário em
`docs/test-plans/`, comece por `docs/test-plans/index.md`):
1. `login.spec.ts` — smoke test do stack inteiro (CORS, Sanctum, guarda de rota, logout).
2. `public-request.spec.ts` — fluxo público crítico do produto (mapa Leaflet via
   `LocationPickerMap.vue`, incluindo geolocalização automática).
3. `panel-viewing.spec.ts` e `panel-filters-sorting.spec.ts` — painel (visualização no
   mapa/lista, filtros, ordenação).
4. `panel-status-management.spec.ts` — assumir/concluir/cancelar pedido, compartilhar
   localização, fluxo ponta a ponta do painel.
5. `operators.spec.ts` e `panel-navigation.spec.ts` — gestão de operadores (admin master)
   e navegação condicional por papel.
6. `rescue-status-logs.spec.ts` — tela de logs de auditoria (admin master).

Único item de `REQUISITOS.md` sem teste (porque a própria funcionalidade não foi
localizada no código): alertas em tempo real via websocket (§5) — ver `CRZ-05` em
`docs/test-plans/integrado.md`.

## Dados de teste

- Nunca assumir banco vazio nem contar linhas absolutas — o reset (`migrate:fresh
  --seed`) só roda uma vez por execução da suíte inteira, não por teste.
- O único dado fixo disponível é o admin master semeado por
  `backend/database/seeders/DatabaseSeeder.php`
  (`admin@pontoderesgate.local` / `password`, `role: admin_master`).
- Testes que precisam de sessão autenticada usam a fixture
  `frontend/e2e/fixtures/auth.ts` (`loginAsAdminMaster`), que faz login via API
  (`POST /api/login`) e injeta o token/usuário no `localStorage`
  (`pontoderesgate.token`/`pontoderesgate.user`) — evita repetir login pela UI em todo
  teste. O fluxo de login pela UI em si continua coberto por `login.spec.ts`.
- Testes que criam dados (ex.: um pedido de socorro) devem gerar um identificador único
  por execução (ex. `E2E teste ${Date.now()}`) e localizar esse dado por
  filtro/busca — nunca por posição ou contagem na lista.
- Não adicionar dados fixos de "pedidos de resgate" aos seeders de módulo
  (`ResgatesDatabaseSeeder`/`UsuariosDatabaseSeeder`) só para o E2E — isso acopla o
  seeder de dev/produção à suíte de teste de forma oculta. Cada spec cria o dado de que
  precisa via o próprio fluxo da aplicação ou via chamada HTTP direta ao backend.

## Seletores

Preferir `getByRole`/`getByLabel`/`getByText`. Usar `data-testid` apenas como exceção
documentada, quando o seletor por role/texto for ambíguo (ex.: múltiplos botões
"Cancelar" na mesma tela).

**Exceção em uso:** os marcadores do mapa do painel (`RescueRequestsMap.vue`) recebem
`data-testid="rescue-request-marker-<id>"` — não há texto/role que distinga um marcador
específico entre vários pedidos plotados simultaneamente (todos são `<span>` dentro de um
`div.leaflet-marker-icon` equivalente), e o ID do pedido já é conhecido pelo teste (retorno
da chamada HTTP que o criou).

## Page Object Model

Não adotado por enquanto — com poucos specs, é abstração prematura. Reavaliar se a
suíte crescer e specs começarem a duplicar lógica de navegação/seletor; se adotado,
documentar a convenção aqui (`e2e/pages/*.page.ts`).

## Nomenclatura

Arquivos de teste: `<fluxo>.spec.ts`, kebab-case, um arquivo por fluxo de tela (não por
componente).
