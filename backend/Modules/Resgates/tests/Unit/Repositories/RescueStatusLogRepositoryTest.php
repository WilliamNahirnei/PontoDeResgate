<?php

namespace Modules\Resgates\Tests\Unit\Repositories;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Resgates\Repositories\RescueStatusLogRepository;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueStatusLogRepositoryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private RescueStatusLogRepository $repository;

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

        $this->repository = new RescueStatusLogRepository;
    }

    #[TestDox('create() deve persistir um novo registro de auditoria de mudança de status.')]
    public function test_create_persists_a_new_status_log(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $operator = User::factory()->create();

        $log = $this->repository->create([
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => RescueRequestStatus::Pendente,
            'new_status' => RescueRequestStatus::EmResgate,
        ]);

        $this->assertDatabaseHas('rescue_status_logs', ['id' => $log->id]);
    }

    #[TestDox('paginateWithRelations() deve carregar os relacionamentos rescueRequest e operator de cada log.')]
    public function test_paginate_with_relations_eager_loads_relations(): void
    {
        RescueStatusLog::factory()->create();

        $result = $this->repository->paginateWithRelations(15);

        $this->assertTrue($result->first()->relationLoaded('rescueRequest'));
        $this->assertTrue($result->first()->relationLoaded('operator'));
    }

    #[TestDox('paginateWithRelations() deve ordenar os logs do mais recente para o mais antigo.')]
    public function test_paginate_with_relations_orders_by_most_recent_first(): void
    {
        $older = RescueStatusLog::factory()->create(['created_at' => now()->subDay()]);
        $newer = RescueStatusLog::factory()->create(['created_at' => now()]);

        $result = $this->repository->paginateWithRelations(15);

        $this->assertSame($newer->id, $result->first()->id);
        $this->assertSame($older->id, $result->last()->id);
    }

    #[TestDox('paginateWithRelations() deve respeitar a quantidade de itens por página.')]
    public function test_paginate_with_relations_respects_the_per_page_value(): void
    {
        RescueStatusLog::factory()->count(3)->create();

        $result = $this->repository->paginateWithRelations(2);

        $this->assertCount(2, $result->items());
        $this->assertSame(3, $result->total());
    }

    #[TestDox('create() deve associar o log ao pedido e ao operador informados e ler os dois status de volta como casos do enum.')]
    public function test_create_persists_the_associations_and_casts_the_statuses(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $operator = User::factory()->create();

        $log = $this->repository->create([
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => RescueRequestStatus::EmResgate,
            'new_status' => RescueRequestStatus::Concluido,
        ]);

        $fresh = $log->fresh();

        $this->assertSame($rescueRequest->id, $fresh->rescue_request_id);
        $this->assertSame($operator->id, $fresh->operator_id);
        $this->assertSame(RescueRequestStatus::EmResgate, $fresh->previous_status);
        $this->assertSame(RescueRequestStatus::Concluido, $fresh->new_status);
    }

    #[DataProvider('allStatuses')]
    #[TestDox('create() deve persistir cada status possível do enum como novo status e lê-lo de volta como o mesmo caso do enum.')]
    public function test_create_persists_each_new_status_value(RescueRequestStatus $status): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $operator = User::factory()->create();

        $log = $this->repository->create([
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => RescueRequestStatus::Pendente,
            'new_status' => $status,
        ]);

        $this->assertSame($status, $log->fresh()->new_status);
    }

    #[TestDox('paginateWithRelations() deve devolver uma página vazia quando não existe nenhum log.')]
    public function test_paginate_with_relations_returns_an_empty_page_when_there_are_no_logs(): void
    {
        $result = $this->repository->paginateWithRelations(15);

        $this->assertSame(0, $result->total());
        $this->assertCount(0, $result->items());
    }

    #[TestDox('paginateWithRelations() deve carregar as relações apontando para o pedido e o operador do próprio log.')]
    public function test_paginate_with_relations_loads_the_relations_of_the_log_itself(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $operator = User::factory()->create();
        RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id, 'operator_id' => $operator->id]);
        RescueStatusLog::factory()->create();

        $result = $this->repository->paginateWithRelations(15);
        $log = $result->first(fn (RescueStatusLog $log) => $log->rescue_request_id === $rescueRequest->id);

        $this->assertTrue($log->rescueRequest->is($rescueRequest));
        $this->assertTrue($log->operator->is($operator));
    }

    #[TestDox('paginateWithRelations() deve devolver todos os logs em uma única página quando a quantidade por página é maior que o total.')]
    public function test_paginate_with_relations_returns_everything_when_per_page_exceeds_the_total(): void
    {
        RescueStatusLog::factory()->count(3)->create();

        $result = $this->repository->paginateWithRelations(50);

        $this->assertCount(3, $result->items());
        $this->assertSame(1, $result->lastPage());
    }

    #[TestDox('paginateWithRelations() deve devolver os logs mais antigos restantes na segunda página.')]
    public function test_paginate_with_relations_returns_the_remaining_older_logs_on_the_second_page(): void
    {
        RescueStatusLog::factory()->create(['created_at' => now()]);
        RescueStatusLog::factory()->create(['created_at' => now()->subDay()]);
        $oldest = RescueStatusLog::factory()->create(['created_at' => now()->subDays(2)]);
        request()->merge(['page' => 2]);

        $result = $this->repository->paginateWithRelations(2);

        $this->assertSame(3, $result->total());
        $this->assertSame([$oldest->id], $result->pluck('id')->all());
    }

    #[TestDox('paginateWithRelations() deve devolver uma página vazia quando a página pedida passa do total de resultados.')]
    public function test_paginate_with_relations_returns_an_empty_page_beyond_the_last_page(): void
    {
        RescueStatusLog::factory()->count(2)->create();
        request()->merge(['page' => 5]);

        $result = $this->repository->paginateWithRelations(2);

        $this->assertSame(2, $result->total());
        $this->assertCount(0, $result->items());
    }
}
