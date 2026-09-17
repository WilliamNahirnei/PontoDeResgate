# Test plan — Resgates

> Cobertura prospectiva completa das funcionalidades do módulo `backend/Modules/Resgates`
> (pedido público, painel, gestão de status, auditoria), com base em
> [`REQUISITOS.md`](../../REQUISITOS.md) §3, §4.1 a §4.3, §4.5 e §7. Cenários que cruzam
> Usuarios e Resgates não aparecem aqui — ver [`integrado.md`](./integrado.md).

## Legenda de status

| Status | Significado |
|---|---|
| `Implementado` | Existe teste automatizado cobrindo o cenário, e ele passa. |
| `Planejado` | A funcionalidade já existe no sistema; o teste ainda não foi escrito, mas está no roadmap conhecido (ex.: a ordem de prioridade documentada em `frontend/.ai/rules/e2e-testing.md`). |
| `Não coberto` | A funcionalidade já existe; não há teste nem plano formal para ela ainda — candidato a ser priorizado. |
| `Não implementado` | A própria funcionalidade (não o teste) ainda não existe no código, ou não foi possível confirmar que existe. |

## 1. Tela pública de pedido

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-01 | StoreRescueRequestRequest (validação) | Unit | `authorize()` permite qualquer requisição (rota pública) | Implementado | `backend/Modules/Resgates/tests/Unit/Http/Requests/RescueRequest/StoreRescueRequestRequestTest.php::test_authorize_allows_any_request` | |
| RES-02 | StoreRescueRequestRequest (validação) | Unit | Latitude é obrigatória | Implementado | `...::test_latitude_is_required` | |
| RES-03 | StoreRescueRequestRequest (validação) | Unit | Longitude é obrigatória | Implementado | `...::test_longitude_is_required` | |
| RES-04 | StoreRescueRequestRequest (validação) | Unit | Latitude deve estar entre -90 e 90 | Implementado | `...::test_latitude_must_be_between_minus_90_and_90` | |
| RES-05 | StoreRescueRequestRequest (validação) | Unit | Latitude dentro do intervalo válido é aceita | Implementado | `...::test_latitude_accepts_a_value_within_range` | |
| RES-06 | StoreRescueRequestRequest (validação) | Unit | Longitude deve estar entre -180 e 180 | Implementado | `...::test_longitude_must_be_between_minus_180_and_180` | |
| RES-07 | StoreRescueRequestRequest (validação) | Unit | Longitude dentro do intervalo válido é aceita | Implementado | `...::test_longitude_accepts_a_value_within_range` | |
| RES-08 | StoreRescueRequestRequest (validação) | Unit | Campos de quantidade não podem ser negativos | Implementado | `...::test_quantity_fields_must_not_be_negative` | |
| RES-09 | StoreRescueRequestRequest (validação) | Unit | Payload válido só com os campos obrigatórios passa na validação | Implementado | `...::test_valid_payload_with_only_required_fields_passes_validation` | |
| RES-10 | StoreRescueRequestRequest (validação) | Unit | Payload válido com todos os campos passa na validação | Implementado | `...::test_valid_payload_with_all_fields_passes_validation` | |
| RES-11 | Pedido público (endpoint) | Feature | Qualquer pessoa envia um pedido de socorro sem autenticação | Implementado | `backend/tests/Feature/RescueRequestPublicSubmissionTest.php::test_anyone_can_submit_a_rescue_request_without_authentication` | |
| RES-12 | Pedido público (endpoint) | Feature | Apenas a localização é obrigatória; os demais campos são opcionais | Implementado | `...::test_only_the_location_is_required` | |
| RES-13 | Pedido público (endpoint) | Feature | Latitude e longitude são obrigatórias | Implementado | `...::test_latitude_and_longitude_are_required` | |
| RES-14 | PublicRequestView | E2E | Cidadão registra um pedido de socorro com sucesso (mapa + formulário) | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("cidadão registra um pedido de socorro com sucesso") | |
| RES-15 | PublicRequestView | E2E | Envio exige localização selecionada no mapa (botão fica desabilitado sem ela) | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("exige localização no mapa antes de enviar") | |
| RES-16 | LocationPickerMap | E2E | Pin de localização é posicionado automaticamente via geolocalização do navegador, quando permitida | Implementado | `frontend/e2e/tests/public-request.spec.ts` ("posiciona o pin automaticamente via geolocalização do navegador, quando permitida") | |
| RES-17 | Pedido público | Feature | Pessoa solicitante não tem nenhum meio de consultar ou editar o pedido após o envio | Implementado | `backend/tests/Feature/RescueRequestPublicSubmissionTest.php::test_the_requester_has_no_endpoint_to_view_or_edit_the_submitted_request` | Verifica que GET/PUT/PATCH em `/api/rescue-requests/{id}` retornam 404 (nenhuma rota de consulta/edição é exposta). |

## 2. Painel — visualização, filtros e ordenação

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-18 | IndexRescueRequestRequest (validação) | Unit | `authorize()` permite qualquer requisição (autorização real é via middleware) | Implementado | `backend/Modules/Resgates/tests/Unit/Http/Requests/RescueRequest/IndexRescueRequestRequestTest.php::test_authorize_allows_any_request` | |
| RES-19 | IndexRescueRequestRequest (validação) | Unit | Payload vazio passa na validação (todos os filtros são opcionais) | Implementado | `...::test_empty_payload_passes_validation` | |
| RES-20 | IndexRescueRequestRequest (validação) | Unit | Status deve ser um valor válido do enum | Implementado | `...::test_status_must_be_a_valid_enum_value` | |
| RES-21 | IndexRescueRequestRequest (validação) | Unit | Status com valor válido do enum é aceito | Implementado | `...::test_status_accepts_a_valid_enum_value` | |
| RES-22 | IndexRescueRequestRequest (validação) | Unit | Campo de ordenação deve ser uma das colunas ordenáveis | Implementado | `...::test_sort_by_must_be_one_of_the_sortable_columns` | |
| RES-23 | IndexRescueRequestRequest (validação) | Unit | Coluna ordenável válida é aceita | Implementado | `...::test_sort_by_accepts_a_valid_sortable_column` | |
| RES-24 | IndexRescueRequestRequest (validação) | Unit | Direção de ordenação deve ser `asc` ou `desc` | Implementado | `...::test_sort_direction_must_be_asc_or_desc` | |
| RES-25 | IndexRescueRequestRequest (validação) | Unit | Direção de ordenação `asc`/`desc` é aceita | Implementado | `...::test_sort_direction_accepts_asc_or_desc` | |
| RES-26 | IndexRescueRequestRequest (validação) | Unit | Filtros de quantidade mínima não podem ser negativos | Implementado | `...::test_min_quantity_filters_must_not_be_negative` | |
| RES-27 | RescueRequestRepository | Unit | Listagem com filtros faz eager load do relacionamento com o operador | Implementado | `backend/Modules/Resgates/tests/Unit/Repositories/RescueRequestRepositoryTest.php::test_list_with_filters_eager_loads_the_operator_relation` | |
| RES-28 | RescueRequestRepository | Unit | Listagem com filtros filtra por status | Implementado | `...::test_list_with_filters_filters_by_status` | |
| RES-29 | RescueRequestRepository | Unit | Listagem com filtros filtra por quantidade mínima | Implementado | `...::test_list_with_filters_filters_by_minimum_quantity` | |
| RES-30 | RescueRequestRepository | Unit | Listagem com filtros exclui pedidos sem a quantidade filtrada preenchida | Implementado | `...::test_list_with_filters_excludes_requests_missing_the_filtered_quantity` | |
| RES-31 | RescueRequestRepository | Unit | Listagem com filtros ordena pela coluna e direção informadas | Implementado | `...::test_list_with_filters_sorts_by_the_given_column_and_direction` | |
| RES-32 | RescueRequestRepository | Unit | Listagem com filtros lista por último os pedidos sem a coluna de ordenação preenchida | Implementado | `...::test_list_with_filters_lists_requests_missing_the_sorted_column_last` | |
| RES-33 | Listagem de pedidos (endpoint) | Feature | Pedidos podem ser filtrados por status | Implementado | `backend/tests/Feature/RescueRequestListingFiltersTest.php::test_rescue_requests_can_be_filtered_by_status` | |
| RES-34 | Listagem de pedidos (endpoint) | Feature | Pedidos podem ser filtrados por quantidade mínima | Implementado | `...::test_rescue_requests_can_be_filtered_by_minimum_quantity` | |
| RES-35 | Listagem de pedidos (endpoint) | Feature | Pedidos podem ser ordenados de forma crescente pelo total de pessoas | Implementado | `...::test_rescue_requests_can_be_sorted_ascending_by_total_people` | |
| RES-36 | Listagem de pedidos (endpoint) | Feature | Pedidos sem a quantidade usada na ordenação aparecem por último | Implementado | `...::test_rescue_requests_without_the_sorted_quantity_are_listed_last` | |
| RES-37 | Listagem de pedidos (endpoint) | Feature | Listagem rejeita campo de ordenação inválido | Implementado | `...::test_rescue_request_listing_rejects_invalid_sort_field` | |
| RES-38 | Listagem de pedidos (endpoint) | Feature | Operadores autenticados conseguem listar os pedidos | Implementado | `backend/tests/Feature/RescueRequestStatusManagementTest.php::test_operators_can_list_rescue_requests` | |
| RES-39 | PanelView (mapa) | E2E | Mapa exibe os pedidos georreferenciados; hover mostra quantidade de pessoas e data/hora | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("hover em um marcador do mapa mostra a quantidade de pessoas e a data/hora do pedido") | |
| RES-40 | PanelView (mapa) | E2E | Mapa se ajusta automaticamente para enquadrar os pedidos apenas na primeira carga | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("mapa se ajusta automaticamente aos pedidos apenas na primeira carga") | |
| RES-41 | PanelView | E2E | Mapa e lista exibem os mesmos pedidos simultaneamente (layout dividido, sem alternância por abas) | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("mapa e lista exibem os mesmos pedidos simultaneamente") | |
| RES-42 | PanelView | E2E | Clicar em um pedido na lista o destaca no mapa; clicar em outro substitui o destaque anterior | Implementado | `frontend/e2e/tests/panel-viewing.spec.ts` ("clicar em um pedido na lista o destaca...") | |
| RES-43 | PanelView (filtros) | E2E | Filtro por status na UI reflete na lista e no mapa | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("filtro por status reflete na lista") | |
| RES-44 | PanelView (filtros) | E2E | Filtro por quantidade mínima (total/homens/mulheres/crianças/idosos/animais) na UI | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("filtro por quantidade mínima reflete na lista") | |
| RES-45 | PanelView (ordenação) | E2E | Ordenação crescente/decrescente por data ou por quantidades na UI | Implementado | `frontend/e2e/tests/panel-filters-sorting.spec.ts` ("ordenação por quantidade reflete na ordem da lista") | |

## 3. Painel — gestão de status

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-46 | CancelRescueRequestRequest (validação) | Unit | `authorize()` permite qualquer requisição | Implementado | `backend/Modules/Resgates/tests/Unit/Http/Requests/RescueRequest/CancelRescueRequestRequestTest.php::test_authorize_allows_any_request` | |
| RES-47 | CancelRescueRequestRequest (validação) | Unit | Motivo do cancelamento é obrigatório | Implementado | `...::test_cancellation_reason_is_required` | |
| RES-48 | CancelRescueRequestRequest (validação) | Unit | Motivo do cancelamento não pode exceder 1000 caracteres | Implementado | `...::test_cancellation_reason_must_not_exceed_1000_characters` | |
| RES-49 | CancelRescueRequestRequest (validação) | Unit | Payload válido passa na validação | Implementado | `...::test_valid_payload_passes_validation` | |
| RES-50 | RescueRequestRepository | Unit | Atualização de status persiste os atributos informados | Implementado | `backend/Modules/Resgates/tests/Unit/Repositories/RescueRequestRepositoryTest.php::test_update_status_persists_the_given_attributes` | |
| RES-51 | RescueRequestRepository | Unit | Recarregar o pedido após a atualização traz o relacionamento com o operador carregado | Implementado | `...::test_fresh_with_operator_reloads_the_model_with_the_relation_loaded` | |
| RES-52 | Assumir pedido (endpoint) | Feature | Operador assume um pedido pendente | Implementado | `backend/tests/Feature/RescueRequestStatusManagementTest.php::test_operator_can_assume_a_pending_rescue_request` | |
| RES-53 | Assumir pedido (endpoint) | Feature | Não é possível assumir um pedido que não está pendente | Implementado | `...::test_cannot_assume_a_rescue_request_that_is_not_pending` | |
| RES-54 | Concluir pedido (endpoint) | Feature | Operador conclui um pedido em atendimento | Implementado | `...::test_operator_can_complete_a_rescue_request_in_progress` | |
| RES-55 | Concluir pedido (endpoint) | Feature | Não é possível concluir um pedido ainda pendente | Implementado | `...::test_cannot_complete_a_pending_rescue_request` | |
| RES-56 | Cancelar pedido (endpoint) | Feature | Operador cancela um pedido informando o motivo | Implementado | `...::test_operator_can_cancel_a_rescue_request_with_a_reason` | |
| RES-57 | Cancelar pedido (endpoint) | Feature | Motivo do cancelamento é obrigatório | Implementado | `...::test_cancellation_reason_is_required` | |
| RES-58 | PanelView | E2E | Assumir pedido pendente pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador assume um pedido pendente pela UI") | |
| RES-59 | PanelView | E2E | Concluir pedido em atendimento pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador conclui um pedido em atendimento pela UI") | |
| RES-60 | PanelView | E2E | Cancelar pedido informando motivo pela UI | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("operador cancela um pedido informando o motivo pela UI") | |
| RES-61 | PanelView | E2E | Compartilhar localização copia os dados para a área de transferência e mostra confirmação visual | Implementado | `frontend/e2e/tests/panel-status-management.spec.ts` ("compartilhar localização copia a URL para a área de transferência") | Teste força `navigator.share` a `undefined` para exercitar o fallback de clipboard de forma determinística (ver comentário no spec). |
| RES-62 | rescue_request (model) | Unit | `rescue_request` usa soft delete — nunca é removido fisicamente do banco | Implementado | `backend/Modules/Resgates/tests/Unit/Models/RescueRequestTest.php::test_delete_soft_deletes_the_rescue_request` e `::test_soft_deleted_rescue_request_is_excluded_from_default_queries` | |

## 4. Auditoria (`rescue_status_logs`)

| ID | Funcionalidade/Tela | Camada | Cenário | Status | Teste automatizado | Observação |
|---|---|---|---|---|---|---|
| RES-63 | RescueStatusLogRepository | Unit | Criação persiste um novo log de status | Implementado | `backend/Modules/Resgates/tests/Unit/Repositories/RescueStatusLogRepositoryTest.php::test_create_persists_a_new_status_log` | |
| RES-64 | RescueStatusLogRepository | Unit | Paginação com relações faz eager load das relações | Implementado | `...::test_paginate_with_relations_eager_loads_relations` | |
| RES-65 | RescueStatusLogRepository | Unit | Paginação com relações ordena do mais recente para o mais antigo | Implementado | `...::test_paginate_with_relations_orders_by_most_recent_first` | |
| RES-66 | RescueStatusLogRepository | Unit | Paginação com relações respeita o valor de itens por página | Implementado | `...::test_paginate_with_relations_respects_the_per_page_value` | |
| RES-67 | Lista de logs (endpoint) | Feature | Admin master lista os logs de mudança de status | Implementado | `backend/tests/Feature/RescueStatusLogListingTest.php::test_admin_master_can_list_rescue_status_logs` | |
| RES-68 | Lista de logs (endpoint) | Feature | Lista de logs é paginada | Implementado | `...::test_rescue_status_log_list_is_paginated` | |
| RES-69 | RescueStatusLogsView | E2E | Tela de logs de auditoria, paginada | Implementado | `frontend/e2e/tests/rescue-status-logs.spec.ts` ("exibe o pedido, o operador e a mudança de status de cada log", "lista de logs é paginada") | |

> As checagens de autorização da lista de logs (apenas admin master pode acessar) são um
> cruzamento entre o papel definido em Usuarios e o dado de Resgates — ver `CRZ-01` e
> `CRZ-02` em [`integrado.md`](./integrado.md).
