<?php

namespace Modules\Resgates\Tests\Unit\Repositories;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Repositories\RescueRequestRepository;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueRequestRepositoryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private RescueRequestRepository $repository;

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

    #[TestDox('listWithFilters() deve carregar o relacionamento operator de cada pedido retornado.')]
    public function test_list_with_filters_eager_loads_the_operator_relation(): void
    {
        RescueRequest::factory()->create();

        $results = $this->repository->listWithFilters([], 'created_at', 'desc');

        $this->assertTrue($results->first()->relationLoaded('operator'));
    }

    #[TestDox('listWithFilters() deve filtrar pedidos pelo status informado.')]
    public function test_list_with_filters_filters_by_status(): void
    {
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido]);

        $results = $this->repository->listWithFilters(['status' => RescueRequestStatus::Pendente->value], 'created_at', 'desc');

        $this->assertCount(1, $results);
        $this->assertSame(RescueRequestStatus::Pendente, $results->first()->status);
    }

    #[TestDox('listWithFilters() deve filtrar pedidos com quantidade mínima de pessoas.')]
    public function test_list_with_filters_filters_by_minimum_quantity(): void
    {
        RescueRequest::factory()->create(['total_people' => 2]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->listWithFilters(['min_total_people' => 5], 'created_at', 'desc');

        $this->assertCount(1, $results);
        $this->assertSame(10, $results->first()->total_people);
    }

    #[TestDox('listWithFilters() não deve considerar um pedido sem a quantidade informada como atendendo a um filtro mínimo.')]
    public function test_list_with_filters_excludes_requests_missing_the_filtered_quantity(): void
    {
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->listWithFilters(['min_total_people' => 0], 'created_at', 'desc');

        $this->assertCount(1, $results);
        $this->assertSame(10, $results->first()->total_people);
    }

    #[TestDox('listWithFilters() deve ordenar pelos pedidos pela coluna e direção informadas.')]
    public function test_list_with_filters_sorts_by_the_given_column_and_direction(): void
    {
        RescueRequest::factory()->create(['total_people' => 5]);
        RescueRequest::factory()->create(['total_people' => 1]);
        RescueRequest::factory()->create(['total_people' => 10]);

        $results = $this->repository->listWithFilters([], 'total_people', 'asc');

        $this->assertSame([1, 5, 10], $results->pluck('total_people')->all());
    }

    #[TestDox('listWithFilters() deve listar por último os pedidos sem a coluna de ordenação preenchida, independente da direção.')]
    public function test_list_with_filters_lists_requests_missing_the_sorted_column_last(): void
    {
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 3]);

        $ascending = $this->repository->listWithFilters([], 'total_people', 'asc');
        $descending = $this->repository->listWithFilters([], 'total_people', 'desc');

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
}
