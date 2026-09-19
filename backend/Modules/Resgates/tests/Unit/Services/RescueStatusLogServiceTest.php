<?php

namespace Modules\Resgates\Tests\Unit\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;
use Modules\Resgates\Services\RescueStatusLogService;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueStatusLogServiceTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    #[TestDox('list() deve repassar a quantidade por página ao Repository e devolver o paginador dele.')]
    public function test_list_delegates_the_per_page_value_to_the_repository(): void
    {
        $paginator = new LengthAwarePaginator([], 0, 20);

        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);
        $statusLogs->shouldReceive('paginateWithRelations')
            ->once()
            ->with(20)
            ->andReturn($paginator);

        $service = new RescueStatusLogService($statusLogs);

        $result = $service->list(20);

        $this->assertSame($paginator, $result);
    }
}
