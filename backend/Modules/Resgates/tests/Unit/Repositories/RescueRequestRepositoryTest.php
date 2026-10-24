<?php

namespace Modules\Resgates\Tests\Unit\Repositories;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Repositories\RescueRequestRepository;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueRequestRepositoryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private RescueRequestRepository $repository;

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function quantityFilters(): array
    {
        return [
            'min_total_people' => ['min_total_people', 'total_people'],
            'min_men_count' => ['min_men_count', 'men_count'],
            'min_women_count' => ['min_women_count', 'women_count'],
            'min_children_count' => ['min_children_count', 'children_count'],
            'min_elderly_count' => ['min_elderly_count', 'elderly_count'],
            'min_animals_count' => ['min_animals_count', 'animals_count'],
        ];
    }

    /**
     * @return array<string, array{0: RescueRequestStatus}>
     */
    public static function allStatuses(): array
    {
        $cases = [];

        foreach (RescueRequestStatus::cases() as $status) {
            $cases[$status->value] = [$status];
        }

        return $cases;
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = new RescueRequestRepository;
    }

    #[TestDox('create() deve persistir um novo pedido de resgate com os atributos informados.')]
    public function test_create_persists_a_new_rescue_request(): void
    {
        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
            'status' => RescueRequestStatus::Pendente,
        ]);

        $this->assertDatabaseHas('rescue_requests', ['id' => $rescueRequest->id]);
    }

    #[TestDox('paginateWithFilters() deve carregar o relacionamento operator de cada pedido retornado.')]
    public function test_paginate_with_filters_eager_loads_the_operator_relation(): void
    {
        RescueRequest::factory()->create();

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertTrue($results->first()->relationLoaded('operator'));
    }

    #[TestDox('paginateWithFilters() deve filtrar pedidos pelo status informado.')]
    public function test_paginate_with_filters_filters_by_status(): void
    {
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido]);

        $results = $this->repository->paginateWithFilters(['status' => RescueRequestStatus::Pendente->value], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertSame(RescueRequestStatus::Pendente, $results->first()->status);
    }

    #[TestDox('paginateWithFilters() deve filtrar pedidos com quantidade mínima de pessoas.')]
    public function test_paginate_with_filters_filters_by_minimum_quantity(): void
    {
        RescueRequest::factory()->create(['total_people' => 2]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->paginateWithFilters(['min_total_people' => 5], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertSame(10, $results->first()->total_people);
    }

    #[TestDox('paginateWithFilters() não deve considerar um pedido sem a quantidade informada como atendendo a um filtro mínimo.')]
    public function test_paginate_with_filters_excludes_requests_missing_the_filtered_quantity(): void
    {
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->paginateWithFilters(['min_total_people' => 0], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertSame(10, $results->first()->total_people);
    }

    #[TestDox('paginateWithFilters() deve ordenar pelos pedidos pela coluna e direção informadas.')]
    public function test_paginate_with_filters_sorts_by_the_given_column_and_direction(): void
    {
        RescueRequest::factory()->create(['total_people' => 5]);
        RescueRequest::factory()->create(['total_people' => 1]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->paginateWithFilters([], 'total_people', 'asc', 50);

        $this->assertSame([1, 5, 10], $results->pluck('total_people')->all());
    }

    #[TestDox('paginateWithFilters() deve listar por último os pedidos sem a coluna de ordenação preenchida, independente da direção.')]
    public function test_paginate_with_filters_lists_requests_missing_the_sorted_column_last(): void
    {
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 3]);

        $ascending = $this->repository->paginateWithFilters([], 'total_people', 'asc', 50);
        $descending = $this->repository->paginateWithFilters([], 'total_people', 'desc', 50);

        $this->assertNull($ascending->last()->total_people);
        $this->assertNull($descending->last()->total_people);
    }

    #[TestDox('updateStatus() deve persistir os atributos informados no pedido.')]
    public function test_update_status_persists_the_given_attributes(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);

        $this->repository->updateStatus($rescueRequest, ['status' => RescueRequestStatus::EmResgate]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::EmResgate->value,
        ]);
    }

    #[TestDox('freshWithOperator() deve recarregar o pedido do banco com o relacionamento operator carregado.')]
    public function test_fresh_with_operator_reloads_the_model_with_the_relation_loaded(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create(['operator_id' => $operator->id]);

        $fresh = $this->repository->freshWithOperator($rescueRequest);

        $this->assertTrue($fresh->relationLoaded('operator'));
        $this->assertTrue($fresh->operator->is($operator));
    }

    #[TestDox('findForUpdate() deve reler o pedido do banco, devolvendo o status atual mesmo que o modelo recebido esteja desatualizado.')]
    public function test_find_for_update_returns_the_current_database_state(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        RescueRequest::query()->whereKey($rescueRequest->id)->update(['status' => RescueRequestStatus::EmResgate]);

        $locked = $this->repository->findForUpdate($rescueRequest);

        $this->assertTrue($locked->is($rescueRequest));
        $this->assertSame(RescueRequestStatus::EmResgate, $locked->status);
        $this->assertSame(RescueRequestStatus::Pendente, $rescueRequest->status);
    }

    #[DataProvider('allStatuses')]
    #[TestDox('create() deve persistir cada status possível do enum e lê-lo de volta como o mesmo caso do enum.')]
    public function test_create_persists_each_status_value(RescueRequestStatus $status): void
    {
        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
            'status' => $status,
        ]);

        $this->assertSame($status, $rescueRequest->fresh()->status);
    }

    #[TestDox('create() deve gravar o status "pendente" definido pelo banco quando o status não é informado.')]
    public function test_create_defaults_the_status_to_pendente_when_omitted(): void
    {
        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
        ]);

        $this->assertSame(RescueRequestStatus::Pendente, $rescueRequest->fresh()->status);
    }

    #[TestDox('create() deve gravar as colunas opcionais como null quando elas não são informadas.')]
    public function test_create_stores_null_for_the_optional_columns_that_are_omitted(): void
    {
        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
        ]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'requester_name' => null,
            'total_people' => null,
            'men_count' => null,
            'women_count' => null,
            'children_count' => null,
            'elderly_count' => null,
            'animals_count' => null,
            'reference_point' => null,
            'cancellation_reason' => null,
            'operator_id' => null,
        ]);
    }

    #[TestDox('create() deve persistir todas as colunas opcionais informadas, inclusive quantidades iguais a zero.')]
    public function test_create_persists_every_optional_column_including_zero_quantities(): void
    {
        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
            'requester_name' => 'Ana Beatriz',
            'total_people' => 5,
            'men_count' => 0,
            'women_count' => 2,
            'children_count' => 1,
            'elderly_count' => 2,
            'animals_count' => 0,
            'reference_point' => 'Casa azul, próximo à ponte.',
            'cancellation_reason' => 'Motivo de teste.',
        ]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'requester_name' => 'Ana Beatriz',
            'total_people' => 5,
            'men_count' => 0,
            'women_count' => 2,
            'children_count' => 1,
            'elderly_count' => 2,
            'animals_count' => 0,
            'reference_point' => 'Casa azul, próximo à ponte.',
            'cancellation_reason' => 'Motivo de teste.',
        ]);
    }

    #[TestDox('create() deve associar o pedido ao operador quando o operator_id informado existe.')]
    public function test_create_associates_the_request_with_an_existing_operator(): void
    {
        $operator = User::factory()->create();

        $rescueRequest = $this->repository->create([
            'latitude' => -23.55,
            'longitude' => -46.63,
            'operator_id' => $operator->id,
        ]);

        $this->assertTrue($rescueRequest->fresh()->operator->is($operator));
    }

    #[TestDox('paginateWithFilters() deve devolver uma coleção vazia quando não existe nenhum pedido.')]
    public function test_paginate_with_filters_returns_an_empty_collection_when_there_are_no_requests(): void
    {
        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertCount(0, $results);
    }

    #[TestDox('paginateWithFilters() deve devolver o único pedido existente quando nenhum filtro é informado.')]
    public function test_paginate_with_filters_returns_the_single_request_when_no_filter_is_given(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($rescueRequest));
    }

    #[TestDox('paginateWithFilters() deve devolver todos os pedidos, de qualquer status, quando nenhum filtro é informado.')]
    public function test_paginate_with_filters_returns_every_request_when_no_filter_is_given(): void
    {
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::EmResgate]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Cancelado]);

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertCount(4, $results);
    }

    #[DataProvider('quantityFilters')]
    #[TestDox('paginateWithFilters() deve aplicar cada filtro de quantidade mínima sobre a sua própria coluna.')]
    public function test_paginate_with_filters_applies_each_minimum_quantity_filter_to_its_own_column(string $filter, string $column): void
    {
        RescueRequest::factory()->create([$column => 2]);
        $matching = RescueRequest::factory()->create([$column => 8]);

        $results = $this->repository->paginateWithFilters([$filter => 5], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($matching));
    }

    #[TestDox('paginateWithFilters() deve incluir o pedido cuja quantidade é exatamente igual ao mínimo informado.')]
    public function test_paginate_with_filters_includes_a_request_whose_quantity_equals_the_minimum(): void
    {
        $atTheLimit = RescueRequest::factory()->create(['total_people' => 5]);
        RescueRequest::factory()->create(['total_people' => 4]);

        $results = $this->repository->paginateWithFilters(['min_total_people' => 5], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($atTheLimit));
    }

    #[TestDox('paginateWithFilters() deve incluir um pedido com quantidade 0 quando o filtro mínimo informado é 0.')]
    public function test_paginate_with_filters_includes_a_request_with_zero_quantity_when_the_minimum_is_zero(): void
    {
        $withZero = RescueRequest::factory()->create(['animals_count' => 0]);
        RescueRequest::factory()->create(['animals_count' => null]);

        $results = $this->repository->paginateWithFilters(['min_animals_count' => 0], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($withZero));
    }

    #[TestDox('paginateWithFilters() deve combinar status e quantidade mínima como interseção, não como união.')]
    public function test_paginate_with_filters_combines_status_and_minimum_quantity_as_an_intersection(): void
    {
        $matching = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente, 'total_people' => 10]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido, 'total_people' => 10]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente, 'total_people' => 2]);

        $results = $this->repository->paginateWithFilters(
            ['status' => RescueRequestStatus::Pendente->value, 'min_total_people' => 5],
            'created_at',
            'desc',
            50
        );

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($matching));
    }

    #[TestDox('paginateWithFilters() deve combinar dois filtros de quantidade mínima como interseção, não como união.')]
    public function test_paginate_with_filters_combines_two_minimum_quantity_filters_as_an_intersection(): void
    {
        $matching = RescueRequest::factory()->create(['men_count' => 5, 'women_count' => 5]);
        RescueRequest::factory()->create(['men_count' => 5, 'women_count' => 1]);
        RescueRequest::factory()->create(['men_count' => 1, 'women_count' => 5]);

        $results = $this->repository->paginateWithFilters(
            ['min_men_count' => 3, 'min_women_count' => 3],
            'created_at',
            'desc',
            50
        );

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($matching));
    }

    #[TestDox('paginateWithFilters() deve devolver uma coleção vazia, sem erro, quando nenhum pedido bate com o status informado.')]
    public function test_paginate_with_filters_returns_an_empty_collection_when_no_request_matches_the_status(): void
    {
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);

        $results = $this->repository->paginateWithFilters(['status' => RescueRequestStatus::Concluido->value], 'created_at', 'desc', 50);

        $this->assertCount(0, $results);
    }

    #[TestDox('paginateWithFilters() deve ignorar filtros informados como null ou string vazia.')]
    public function test_paginate_with_filters_ignores_null_and_empty_string_filters(): void
    {
        RescueRequest::factory()->count(2)->create();

        $results = $this->repository->paginateWithFilters(
            ['status' => null, 'min_total_people' => '', 'min_men_count' => null],
            'created_at',
            'desc',
            50
        );

        $this->assertCount(2, $results);
    }

    #[TestDox('paginateWithFilters() não deve tratar as chaves de ordenação presentes no array de filtros como filtros.')]
    public function test_paginate_with_filters_does_not_treat_sorting_keys_as_filters(): void
    {
        RescueRequest::factory()->count(2)->create();

        $results = $this->repository->paginateWithFilters(
            ['sort_by' => 'total_people', 'sort_direction' => 'asc'],
            'created_at',
            'desc',
            50
        );

        $this->assertCount(2, $results);
    }

    #[TestDox('paginateWithFilters() deve ordenar por data de criação do mais antigo para o mais recente na direção "asc".')]
    public function test_paginate_with_filters_sorts_by_created_at_ascending(): void
    {
        $newest = RescueRequest::factory()->create(['created_at' => now()]);
        $oldest = RescueRequest::factory()->create(['created_at' => now()->subDays(2)]);
        $middle = RescueRequest::factory()->create(['created_at' => now()->subDay()]);

        $results = $this->repository->paginateWithFilters([], 'created_at', 'asc', 50);

        $this->assertSame([$oldest->id, $middle->id, $newest->id], $results->pluck('id')->all());
    }

    #[TestDox('paginateWithFilters() deve ordenar por data de criação do mais recente para o mais antigo na direção "desc".')]
    public function test_paginate_with_filters_sorts_by_created_at_descending(): void
    {
        $newest = RescueRequest::factory()->create(['created_at' => now()]);
        $oldest = RescueRequest::factory()->create(['created_at' => now()->subDays(2)]);
        $middle = RescueRequest::factory()->create(['created_at' => now()->subDay()]);

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertSame([$newest->id, $middle->id, $oldest->id], $results->pluck('id')->all());
    }

    #[TestDox('paginateWithFilters() deve ordenar do maior para o menor na direção "desc", deixando os pedidos sem a quantidade por último.')]
    public function test_paginate_with_filters_sorts_descending_with_missing_quantities_last(): void
    {
        RescueRequest::factory()->create(['total_people' => 5]);
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->paginateWithFilters([], 'total_people', 'desc', 50);

        $this->assertSame([10, 5, null], $results->pluck('total_people')->all());
    }

    #[TestDox('paginateWithFilters() não deve listar pedidos removidos por soft delete.')]
    public function test_paginate_with_filters_excludes_soft_deleted_requests(): void
    {
        $kept = RescueRequest::factory()->create();
        RescueRequest::factory()->create()->delete();

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 50);

        $this->assertCount(1, $results);
        $this->assertTrue($results->first()->is($kept));
    }

    #[TestDox('paginateWithFilters() deve lançar QueryException quando a coluna de ordenação não existe (a validação é responsabilidade do Form Request).')]
    public function test_paginate_with_filters_throws_a_query_exception_for_an_unknown_sort_column(): void
    {
        RescueRequest::factory()->create();

        $this->expectException(QueryException::class);

        $this->repository->paginateWithFilters([], 'coluna_inexistente', 'asc', 50);
    }

    #[TestDox('paginateWithFilters() deve lançar InvalidArgumentException quando a direção de ordenação não é asc nem desc.')]
    public function test_paginate_with_filters_throws_for_an_invalid_sort_direction(): void
    {
        RescueRequest::factory()->create();

        $this->expectException(\InvalidArgumentException::class);

        $this->repository->paginateWithFilters([], 'created_at', 'sideways', 50);
    }

    #[TestDox('updateStatus() deve devolver a mesma instância recebida, já com o novo status.')]
    public function test_update_status_returns_the_same_instance_with_the_new_status(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);

        $updated = $this->repository->updateStatus($rescueRequest, ['status' => RescueRequestStatus::EmResgate]);

        $this->assertSame($rescueRequest, $updated);
        $this->assertSame(RescueRequestStatus::EmResgate, $updated->status);
    }

    #[DataProvider('allStatuses')]
    #[TestDox('updateStatus() deve persistir cada status possível do enum e lê-lo de volta como o mesmo caso do enum.')]
    public function test_update_status_persists_each_status_value(RescueRequestStatus $status): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);

        $this->repository->updateStatus($rescueRequest, ['status' => $status]);

        $this->assertSame($status, $rescueRequest->fresh()->status);
    }

    #[TestDox('updateStatus() deve persistir o operador atribuído junto com o novo status.')]
    public function test_update_status_persists_the_assigned_operator(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $this->repository->updateStatus($rescueRequest, [
            'operator_id' => $operator->id,
            'status' => RescueRequestStatus::EmResgate,
        ]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'status' => RescueRequestStatus::EmResgate->value,
        ]);
    }

    #[TestDox('updateStatus() deve persistir o motivo do cancelamento junto com o novo status.')]
    public function test_update_status_persists_the_cancellation_reason(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $this->repository->updateStatus($rescueRequest, [
            'cancellation_reason' => 'Solicitante desistiu do resgate.',
            'status' => RescueRequestStatus::Cancelado,
        ]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'cancellation_reason' => 'Solicitante desistiu do resgate.',
            'status' => RescueRequestStatus::Cancelado->value,
        ]);
    }

    #[TestDox('freshWithOperator() deve carregar a relação operator como null quando o pedido não tem operador atribuído.')]
    public function test_fresh_with_operator_loads_a_null_operator_when_the_request_has_none(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['operator_id' => null]);

        $fresh = $this->repository->freshWithOperator($rescueRequest);

        $this->assertTrue($fresh->relationLoaded('operator'));
        $this->assertNull($fresh->operator);
    }

    #[TestDox('freshWithOperator() deve devolver uma nova instância com o estado do banco, descartando alterações não salvas em memória.')]
    public function test_fresh_with_operator_discards_unsaved_in_memory_changes(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $rescueRequest->status = RescueRequestStatus::Concluido;

        $fresh = $this->repository->freshWithOperator($rescueRequest);

        $this->assertNotSame($rescueRequest, $fresh);
        $this->assertSame(RescueRequestStatus::Pendente, $fresh->status);
    }

    #[TestDox('paginateWithFilters() deve devolver só a quantidade de pedidos da página pedida, com o total de pedidos que atendem aos filtros.')]
    public function test_paginate_with_filters_returns_only_the_requested_page_with_the_total(): void
    {
        RescueRequest::factory()->count(12)->create();

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 5);

        $this->assertCount(5, $results);
        $this->assertSame(12, $results->total());
        $this->assertSame(5, $results->perPage());
        $this->assertSame(3, $results->lastPage());
    }

    #[TestDox('paginateWithFilters() deve devolver os pedidos seguintes na segunda página, sem repetir os da primeira.')]
    public function test_paginate_with_filters_returns_different_requests_on_the_second_page(): void
    {
        RescueRequest::factory()->count(12)->create();

        $first = $this->repository->paginateWithFilters([], 'created_at', 'desc', 5);
        request()->merge(['page' => 2]);
        $second = $this->repository->paginateWithFilters([], 'created_at', 'desc', 5);

        $this->assertSame(2, $second->currentPage());
        $this->assertCount(5, $second);
        $this->assertEmpty($first->pluck('id')->intersect($second->pluck('id')));
    }

    #[TestDox('paginateWithFilters() deve devolver só os pedidos restantes na última página.')]
    public function test_paginate_with_filters_returns_the_remaining_requests_on_the_last_page(): void
    {
        RescueRequest::factory()->count(12)->create();
        request()->merge(['page' => 3]);

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 5);

        $this->assertCount(2, $results);
    }

    #[TestDox('paginateWithFilters() deve devolver uma página vazia quando a página pedida passa da última.')]
    public function test_paginate_with_filters_returns_an_empty_page_beyond_the_last_one(): void
    {
        RescueRequest::factory()->count(3)->create();
        request()->merge(['page' => 9]);

        $results = $this->repository->paginateWithFilters([], 'created_at', 'desc', 5);

        $this->assertCount(0, $results);
        $this->assertSame(3, $results->total());
    }

    #[TestDox('paginateWithFilters() deve contar no total só os pedidos que atendem aos filtros.')]
    public function test_paginate_with_filters_counts_only_the_filtered_requests_in_the_total(): void
    {
        RescueRequest::factory()->count(7)->create(['status' => RescueRequestStatus::Pendente]);
        RescueRequest::factory()->count(4)->create(['status' => RescueRequestStatus::Concluido]);

        $results = $this->repository->paginateWithFilters(['status' => 'pendente'], 'created_at', 'desc', 5);

        $this->assertSame(7, $results->total());
        $this->assertCount(5, $results);
    }

    #[TestDox('paginateWithFilters() deve manter os pedidos sem a quantidade ordenada no fim da lista inteira, e não de cada página.')]
    public function test_paginate_with_filters_keeps_requests_without_the_quantity_at_the_end_of_the_whole_list(): void
    {
        RescueRequest::factory()->count(3)->create(['total_people' => null]);
        foreach ([1, 2, 3, 4] as $quantity) {
            RescueRequest::factory()->create(['total_people' => $quantity]);
        }

        $first = $this->repository->paginateWithFilters([], 'total_people', 'desc', 4);
        request()->merge(['page' => 2]);
        $second = $this->repository->paginateWithFilters([], 'total_people', 'desc', 4);

        $this->assertSame([4, 3, 2, 1], $first->pluck('total_people')->all());
        $this->assertSame([null, null, null], $second->pluck('total_people')->all());
    }

    #[TestDox('paginateWithFilters() deve manter a ordem estável entre páginas quando vários pedidos têm o mesmo valor de ordenação.')]
    public function test_paginate_with_filters_has_a_stable_order_across_pages_when_values_tie(): void
    {
        RescueRequest::factory()->count(6)->create(['total_people' => 2]);

        $first = $this->repository->paginateWithFilters([], 'total_people', 'asc', 3);
        request()->merge(['page' => 2]);
        $second = $this->repository->paginateWithFilters([], 'total_people', 'asc', 3);

        $this->assertCount(6, $first->pluck('id')->merge($second->pluck('id'))->unique());
    }

    #[TestDox('updateStatus() deve persistir a observação da conclusão junto com o novo status.')]
    public function test_update_status_persists_the_completion_note(): void
    {
        $rescueRequest = RescueRequest::factory()->emResgate()->create();

        $this->repository->updateStatus($rescueRequest, [
            'completion_note' => 'Família resgatada em segurança.',
            'status' => RescueRequestStatus::Concluido,
        ]);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'completion_note' => 'Família resgatada em segurança.',
            'status' => RescueRequestStatus::Concluido->value,
        ]);
    }
}
