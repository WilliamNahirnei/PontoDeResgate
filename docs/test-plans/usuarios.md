# Test plan — Usuarios

> Cenários funcionais do sistema rodando — autenticação, papéis e gestão de operadores —
> derivados de [`REQUISITOS.md`](../../REQUISITOS.md) §2, §4.4 e §9 e verificados por
> Playwright ou por exploração manual. Testes Unit e de endpoint do backend não entram
> aqui. Cenários que cruzam Usuarios e Resgates ficam em [`integrado.md`](./integrado.md).

## Legenda

**Camada** — este plano cobre só o comportamento funcional do sistema rodando. Testes Unit e de endpoint (Feature) do backend testam código e **não fazem parte dele**.

| Camada | Significado |
|---|---|
| `E2E` | Cenário verificável pela interface, automatizado (ou a automatizar) em Playwright, em `frontend/e2e/tests/`. |
| `Exploratório` | Cenário que exige algo fora da interface (ex.: manipular o banco) ou que só faz sentido explorar à mão; verificado com o sistema rodando, sem spec Playwright. |

**Status**

| Status | Significado |
|---|---|
| `Implementado` | Existe spec Playwright para o cenário e ele foi visto passando. |
| `Planejado` | A funcionalidade existe; o spec ainda não foi escrito, mas tem prioridade conhecida. |
| `Não coberto` | A funcionalidade existe; não há spec nem plano formal — candidato a ser priorizado. Para cenários `Exploratório` é o estado normal: não há automação. |
| `Não implementado` | A própria funcionalidade (não o teste) não existe no código, ou não foi possível confirmar que existe. |

## 1. Autenticação e sessão

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| USR-18 | LoginView | E2E | Login válido redireciona para o painel | Implementado | `frontend/e2e/tests/login.spec.ts` ("login válido redireciona para o painel") | Usa as credenciais do admin master semeado (`admin@pontoderesgate.local` / `password`, `REQUISITOS.md` §9). Se o seeder quebrar, este teste e a maior parte da suíte falham em cascata. |
| USR-19 | LoginView | E2E | Login inválido mostra mensagem de erro | Implementado | `frontend/e2e/tests/login.spec.ts` ("login inválido mostra mensagem de erro") |  |
| USR-20 | Painel (guarda de rota) | E2E | Acesso ao painel sem sessão redireciona para o login | Implementado | `frontend/e2e/tests/login.spec.ts` ("acesso ao painel sem sessão redireciona para o login") |  |
| USR-21 | Painel (guarda de rota) | E2E | Sessão de admin master injetada acessa o painel diretamente, sem passar pela tela de login | Implementado | `frontend/e2e/tests/login.spec.ts` ("sessão de admin master acessa o painel diretamente") |  |
| USR-22 | LoginView / Painel | E2E | Logout pela UI encerra a sessão e redireciona ao login | Implementado | `frontend/e2e/tests/login.spec.ts` ("logout pela UI encerra a sessão e redireciona ao login") |  |
| USR-70 | Painel (guarda de rota) | E2E | Visitante sem sessão que acessa diretamente `/painel/operadores`, `/painel/operadores/novo` ou `/painel/logs` é levado ao login | Não coberto | — | USR-20 só cobre `/painel`. Papel × tela: visitante é a célula proibida das três telas de admin master. |
| USR-61 | Painel (sessão revogada) | E2E | Operador desativado com o painel já aberto é levado à tela de login na próxima requisição | Não implementado | — | `frontend/src/services/api.js` só tem interceptor de requisição, nenhum de resposta para 401: a sessão continua exibindo o painel com as chamadas falhando. `REQUISITOS.md` §4.4 só define que o desativado não se autentica; o comportamento da sessão já aberta não está especificado — confirmar o requisito antes de implementar ou testar. |
| USR-79 | Painel / logout | E2E | Depois do logout, o botão "voltar" do navegador não reabre o painel | Não coberto | — | USR-22 só confere o redirecionamento e o storage limpo; a navegação para trás depois de sair não é exercitada. Cuidado: a fixture de login reinjeta o token a cada carregamento de documento (ver comentário em `login.spec.ts`). |
| USR-80 | Painel (sessão) | E2E | Recarregar a página com o painel aberto mantém a sessão do operador | Não coberto | — | USR-21 injeta a sessão pronta; o caminho login pela tela → recarregar não é exercitado. |

## 2. Gestão de operadores (admin master)

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| USR-54 | OperatorCreateView | E2E | Admin master cadastra um novo operador pela tela | Implementado | `frontend/e2e/tests/operators.spec.ts` ("admin master cadastra um novo operador pela tela") |  |
| USR-55 | OperatorsListView | E2E | Lista de operadores: filtro por nome/e-mail e paginação pela UI | Implementado | `frontend/e2e/tests/operators.spec.ts` ("lista de operadores pode ser filtrada por nome e por e-mail", "lista de operadores é paginada") | Os testes de filtro só afirmam que o operador esperado aparece; não afirmam que os não correspondentes somem. |
| USR-56 | OperatorsListView | E2E | Ativar/desativar operador pela UI | Implementado | `frontend/e2e/tests/operators.spec.ts` ("admin master desativa e reativa um operador pela tela") |  |
| USR-57 | Navegação do painel | E2E | Operador comum não vê o item de menu de gestão de operadores | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("operador comum não vê os itens de menu de gestão de operadores nem de logs") |  |
| USR-69 | OperatorCreateView | E2E | Cadastro com e-mail já existente mostra mensagem de erro na tela e mantém o formulário | Não coberto | — | Fiação da UI: a view exibe `error.response.data.message` cru. Como `APP_LOCALE=en`, a mensagem provavelmente aparece em inglês numa interface em português — conferir ao escrever o teste. |
| USR-72 | LoginView | E2E | Operador desativado pelo admin master não consegue entrar pela tela de login | Não coberto | — | `REQUISITOS.md` §4.4. A tela mostra a mesma mensagem genérica ("E-mail ou senha inválidos.") para qualquer falha de login, inclusive desativado — confirmar se é o desejado. |
| USR-73 | LoginView | E2E | Operador reativado volta a conseguir entrar pela tela de login | Não coberto | — | Fecha o ciclo de USR-56 (desativar e reativar): o efeito observável de reativar é poder entrar de novo. |
| USR-74 | OperatorCreateView / LoginView | E2E | Operador recém-cadastrado pelo admin master entra com a senha definida no cadastro e vê o painel sem os itens de menu de admin master | Não coberto | — | Fluxo ponta a ponta do §4.4; USR-54 só confere a lista depois do cadastro. |
| USR-75 | OperatorCreateView | E2E | Cadastro sem nome, sem e-mail, sem senha ou com senha fraca mostra erro e não cadastra o operador | Não coberto | — | Como `APP_LOCALE=en`, as mensagens de validação exibidas provavelmente estão em inglês numa interface em português (ver USR-69). |
| USR-76 | OperatorsListView | E2E | A lista mostra somente operadores (nunca o admin master), em ordem alfabética de nome | Não coberto | — | `REQUISITOS.md` §4.4: "exibe os dados dos operadores cadastrados". |
| USR-77 | OperatorsListView | E2E | Filtros de nome e de e-mail podem ser combinados; sem correspondência a lista mostra "Nenhum operador encontrado." | Não coberto | — | USR-55 testa cada filtro isolado e só confere presença. |
| USR-78 | OperatorsListView | E2E | O botão "Novo operador" da lista leva ao formulário de cadastro | Não coberto | — | `REQUISITOS.md` §4.4. USR-54 abre o cadastro por URL direta. |
