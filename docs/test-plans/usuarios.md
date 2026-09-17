# Test plan — Usuarios

> Cobertura prospectiva completa das funcionalidades do módulo `backend/Modules/Usuarios`
> (autenticação, papéis, gestão de operadores), com base em
> [`REQUISITOS.md`](../../REQUISITOS.md) §2 e §4.4. Cenários que cruzam Usuarios e
> Resgates não aparecem aqui — ver [`integrado.md`](./integrado.md).

## Legenda de status

| Status | Significado |
|---|---|
| `Implementado` | Existe teste automatizado cobrindo o cenário, e ele passa. |
| `Planejado` | A funcionalidade já existe no sistema; o teste ainda não foi escrito, mas está no roadmap conhecido (ex.: a ordem de prioridade documentada em `frontend/.ai/rules/e2e-testing.md`). |
| `Não coberto` | A funcionalidade já existe; não há teste nem plano formal para ela ainda — candidato a ser priorizado. |
| `Não implementado` | A própria funcionalidade (não o teste) ainda não existe no código, ou não foi possível confirmar que existe. |

## 1. Autenticação (login/logout)

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| USR-01 | LoginRequest (validação) | Unit | `authorize()` permite qualquer requisição (autorização real é tratada fora do FormRequest) | Implementado | `backend/Modules/Usuarios/tests/Unit/Http/Requests/Auth/LoginRequestTest.php::test_authorize_allows_any_request` | |
| USR-02 | LoginRequest (validação) | Unit | E-mail é obrigatório | Implementado | `...::test_email_is_required` | |
| USR-03 | LoginRequest (validação) | Unit | Senha é obrigatória | Implementado | `...::test_password_is_required` | |
| USR-04 | LoginRequest (validação) | Unit | E-mail deve ter formato válido | Implementado | `...::test_email_must_be_a_valid_email_address` | |
| USR-05 | LoginRequest (validação) | Unit | E-mail com formato válido é aceito | Implementado | `...::test_email_accepts_a_valid_email_address` | |
| USR-06 | LoginRequest (validação) | Unit | Payload válido passa na validação | Implementado | `...::test_valid_payload_passes_validation` | |
| USR-07 | User (model) | Unit | `isAdminMaster()` retorna true para usuário admin master | Implementado | `backend/Modules/Usuarios/tests/Unit/Models/UserTest.php::test_is_admin_master_returns_true_for_an_admin_master_user` | |
| USR-08 | User (model) | Unit | `isAdminMaster()` retorna false para usuário operador | Implementado | `...::test_is_admin_master_returns_false_for_an_operator_user` | |
| USR-09 | User (model) | Unit | `isOperador()` retorna true para usuário operador | Implementado | `...::test_is_operador_returns_true_for_an_operator_user` | |
| USR-10 | User (model) | Unit | `isOperador()` retorna false para usuário admin master | Implementado | `...::test_is_operador_returns_false_for_an_admin_master_user` | |
| USR-11 | UserRepository | Unit | Busca por e-mail retorna o usuário correspondente | Implementado | `backend/Modules/Usuarios/tests/Unit/Repositories/UserRepositoryTest.php::test_find_by_email_returns_the_matching_user` | |
| USR-12 | UserRepository | Unit | Busca por e-mail retorna null quando não há usuário correspondente | Implementado | `...::test_find_by_email_returns_null_when_no_user_matches` | |
| USR-13 | Login (endpoint) | Feature | Operador faz login com credenciais válidas e recebe token | Implementado | `backend/tests/Feature/AuthenticationTest.php::test_operator_can_login_with_valid_credentials` | |
| USR-14 | Login (endpoint) | Feature | Login falha com credenciais inválidas | Implementado | `...::test_login_fails_with_invalid_credentials` | |
| USR-15 | Login (endpoint) | Feature | Usuário desativado não consegue logar | Implementado | `...::test_deactivated_user_cannot_login` | |
| USR-16 | Logout (endpoint) | Feature | Usuário autenticado faz logout e o token é revogado | Implementado | `...::test_authenticated_user_can_logout` | |
| USR-17 | Painel (guarda de rota) | Feature | Visitante não autenticado não acessa os endpoints do painel | Implementado | `...::test_guests_cannot_access_the_panel_endpoints` | |
| USR-18 | LoginView | E2E | Login válido redireciona para o painel | Implementado | `frontend/e2e/tests/login.spec.ts` ("login válido redireciona para o painel") | |
| USR-19 | LoginView | E2E | Login inválido mostra mensagem de erro | Implementado | `frontend/e2e/tests/login.spec.ts` ("login inválido mostra mensagem de erro") | |
| USR-20 | Painel (guarda de rota) | E2E | Acesso ao painel sem sessão redireciona para o login | Implementado | `frontend/e2e/tests/login.spec.ts` ("acesso ao painel sem sessão redireciona para o login") | |
| USR-21 | Painel (guarda de rota) | E2E | Sessão de admin master injetada acessa o painel diretamente, sem passar pela tela de login | Implementado | `frontend/e2e/tests/login.spec.ts` ("sessão de admin master acessa o painel diretamente") | |
| USR-22 | LoginView / Painel | E2E | Logout pela UI encerra a sessão e redireciona ao login | Implementado | `frontend/e2e/tests/login.spec.ts` ("logout pela UI encerra a sessão e redireciona ao login") | |

## 2. Gestão de operadores (admin master)

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| USR-23 | StoreOperatorRequest (validação) | Unit | `authorize()` permite usuário admin master | Implementado | `backend/Modules/Usuarios/tests/Unit/Http/Requests/Operator/StoreOperatorRequestTest.php::test_authorize_allows_an_admin_master_user` | |
| USR-24 | StoreOperatorRequest (validação) | Unit | `authorize()` nega usuário que não é admin master | Implementado | `...::test_authorize_denies_a_non_admin_master_user` | |
| USR-25 | StoreOperatorRequest (validação) | Unit | `authorize()` nega visitante | Implementado | `...::test_authorize_denies_a_guest` | |
| USR-26 | StoreOperatorRequest (validação) | Unit | Nome é obrigatório | Implementado | `...::test_name_is_required` | |
| USR-27 | StoreOperatorRequest (validação) | Unit | E-mail é obrigatório | Implementado | `...::test_email_is_required` | |
| USR-28 | StoreOperatorRequest (validação) | Unit | Senha é obrigatória | Implementado | `...::test_password_is_required` | |
| USR-29 | StoreOperatorRequest (validação) | Unit | E-mail deve ser único | Implementado | `...::test_email_must_be_unique` | |
| USR-30 | StoreOperatorRequest (validação) | Unit | E-mail único é aceito | Implementado | `...::test_email_accepts_a_unique_email` | |
| USR-31 | StoreOperatorRequest (validação) | Unit | Senha deve atender às regras padrão de senha | Implementado | `...::test_password_must_meet_the_default_password_rules` | |
| USR-32 | StoreOperatorRequest (validação) | Unit | Senha que atende às regras padrão é aceita | Implementado | `...::test_password_accepts_a_password_meeting_the_default_rules` | |
| USR-33 | StoreOperatorRequest (validação) | Unit | Payload válido passa na validação | Implementado | `...::test_valid_payload_passes_validation` | |
| USR-34 | UserRepository | Unit | Paginação de operadores só inclui usuários com papel operador | Implementado | `backend/Modules/Usuarios/tests/Unit/Repositories/UserRepositoryTest.php::test_paginate_operators_only_includes_users_with_the_operator_role` | |
| USR-35 | UserRepository | Unit | Paginação de operadores filtra por nome | Implementado | `...::test_paginate_operators_filters_by_name` | |
| USR-36 | UserRepository | Unit | Paginação de operadores filtra por e-mail | Implementado | `...::test_paginate_operators_filters_by_email` | |
| USR-37 | UserRepository | Unit | Paginação de operadores respeita o valor de itens por página | Implementado | `...::test_paginate_operators_respects_the_per_page_value` | |
| USR-38 | UserRepository | Unit | Criação persiste um novo usuário | Implementado | `...::test_create_persists_a_new_user` | |
| USR-39 | UserRepository | Unit | Atualização persiste os atributos informados | Implementado | `...::test_update_persists_the_given_attributes` | |
| USR-40 | UserRepository | Unit | Revogação de tokens apaga todos os tokens do usuário | Implementado | `...::test_revoke_tokens_deletes_every_token_of_the_user` | |
| USR-41 | Cadastro de operador (endpoint) | Feature | Admin master cadastra um novo operador | Implementado | `backend/tests/Feature/OperatorManagementTest.php::test_admin_master_can_register_a_new_operator` | |
| USR-42 | Cadastro de operador (endpoint) | Feature | Operador comum não pode cadastrar novos operadores | Implementado | `...::test_regular_operator_cannot_register_new_operators` | |
| USR-43 | Cadastro de operador (endpoint) | Feature | Visitante não pode cadastrar operadores | Implementado | `...::test_guests_cannot_register_operators` | |
| USR-44 | Lista de operadores (endpoint) | Feature | Admin master lista os operadores cadastrados | Implementado | `...::test_admin_master_can_list_operators` | |
| USR-45 | Lista de operadores (endpoint) | Feature | Lista de operadores é paginada | Implementado | `...::test_operator_list_is_paginated` | |
| USR-46 | Lista de operadores (endpoint) | Feature | Lista de operadores pode ser filtrada por nome | Implementado | `...::test_operator_list_can_be_filtered_by_name` | |
| USR-47 | Lista de operadores (endpoint) | Feature | Lista de operadores pode ser filtrada por e-mail | Implementado | `...::test_operator_list_can_be_filtered_by_email` | |
| USR-48 | Lista de operadores (endpoint) | Feature | Operador comum não pode listar operadores | Implementado | `...::test_regular_operator_cannot_list_operators` | |
| USR-49 | Lista de operadores (endpoint) | Feature | Visitante não pode listar operadores | Implementado | `...::test_guests_cannot_list_operators` | |
| USR-50 | Ativar/desativar operador (endpoint) | Feature | Admin master desativa um operador | Implementado | `...::test_admin_master_can_deactivate_an_operator` | |
| USR-51 | Ativar/desativar operador (endpoint) | Feature | Admin master reativa um operador desativado | Implementado | `...::test_admin_master_can_reactivate_a_deactivated_operator` | |
| USR-52 | Ativar/desativar operador (endpoint) | Feature | Desativar um operador revoga os tokens dele | Implementado | `...::test_deactivating_an_operator_revokes_their_tokens` | |
| USR-53 | Ativar/desativar operador (endpoint) | Feature | Operador comum não pode desativar outros operadores | Implementado | `...::test_regular_operator_cannot_deactivate_other_operators` | |
| USR-54 | OperatorCreateView | E2E | Admin master cadastra um novo operador pela tela | Implementado | `frontend/e2e/tests/operators.spec.ts` ("admin master cadastra um novo operador pela tela") | |
| USR-55 | OperatorsListView | E2E | Lista de operadores: filtro por nome/e-mail e paginação pela UI | Implementado | `frontend/e2e/tests/operators.spec.ts` ("lista de operadores pode ser filtrada por nome e por e-mail", "lista de operadores é paginada") | |
| USR-56 | OperatorsListView | E2E | Ativar/desativar operador pela UI | Implementado | `frontend/e2e/tests/operators.spec.ts` ("admin master desativa e reativa um operador pela tela") | |
| USR-57 | Navegação do painel | E2E | Operador comum não vê o item de menu de gestão de operadores | Implementado | `frontend/e2e/tests/panel-navigation.spec.ts` ("operador comum não vê os itens de menu de gestão de operadores nem de logs") | |
