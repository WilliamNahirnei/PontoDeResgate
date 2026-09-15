<?php

namespace Modules\Resgates\Tests\Unit\Repositories;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Resgates\Repositories\RescueStatusLogRepository;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueStatusLogRepositoryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private RescueStatusLogRepository $repository;

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
}
