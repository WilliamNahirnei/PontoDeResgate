<?php

namespace Modules\Resgates\Tests\Unit\Services;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Resgates\Repositories\Contracts\RescueRequestRepositoryInterface;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;
use Modules\Resgates\Services\RescueRequestService;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RescueRequestServiceTest extends TestCase
{
    use LazilyRefreshDatabase, MockeryPHPUnitIntegration;

    #[TestDox('submit() deve fixar o status como "pendente", ignorando qualquer status informado nos dados.')]
    public function test_submit_forces_the_status_to_pendente_regardless_of_input(): void
    {
        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('create')
            ->once()
            ->with(\Mockery::on(fn (array $attributes) => $attributes['status'] === RescueRequestStatus::Pendente
                && $attributes['requester_name'] === 'Ana Beatriz'
            ))
            ->andReturn(RescueRequest::factory()->make(['status' => RescueRequestStatus::Pendente]));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $service->submit([
            'requester_name' => 'Ana Beatriz',
            'status' => RescueRequestStatus::Concluido,
        ]);
    }

    #[TestDox('assume() deve atribuir o operador e mudar o status para "em_resgate" quando o pedido está "pendente".')]
    public function test_assume_transitions_a_pending_request_to_em_resgate(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('updateStatus')
            ->once()
            ->with($rescueRequest, [
                'operator_id' => $operator->id,
                'status' => RescueRequestStatus::EmResgate,
            ])
            ->andReturn($rescueRequest);

        $rescueRequests->shouldReceive('freshWithOperator')
            ->once()
            ->with($rescueRequest)
            ->andReturn($rescueRequest);

        $statusLogs->shouldReceive('create')
            ->once()
            ->with([
                'rescue_request_id' => $rescueRequest->id,
                'operator_id' => $operator->id,
                'previous_status' => RescueRequestStatus::Pendente,
                'new_status' => RescueRequestStatus::EmResgate,
            ])
            ->andReturn(\Mockery::mock(RescueStatusLog::class));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $service->assume($rescueRequest, $operator);
    }

    #[TestDox('assume() deve rejeitar um pedido que não está mais "pendente", sem alterar o status no banco.')]
    public function test_assume_rejects_a_request_that_is_not_pending(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::EmResgate]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->assume($rescueRequest, $operator);
            $this->fail('Esperava que assume() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::EmResgate->value,
        ]);
    }

    #[TestDox('complete() deve rejeitar um pedido que não está "em_resgate", sem alterar o status no banco.')]
    public function test_complete_rejects_a_request_that_is_not_in_progress(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->complete($rescueRequest, $operator);
            $this->fail('Esperava que complete() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Pendente->value,
        ]);
    }

    #[TestDox('cancel() deve rejeitar um pedido já "concluido", sem alterar o status no banco.')]
    public function test_cancel_rejects_a_request_that_is_already_concluded(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->cancel($rescueRequest, $operator, 'Solicitante desistiu.');
            $this->fail('Esperava que cancel() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Concluido->value,
        ]);
    }

    #[TestDox('cancel() deve rejeitar um pedido já "cancelado", sem alterar o status no banco.')]
    public function test_cancel_rejects_a_request_that_is_already_cancelled(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Cancelado]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->cancel($rescueRequest, $operator, 'Solicitante desistiu.');
            $this->fail('Esperava que cancel() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Cancelado->value,
        ]);
    }

    #[TestDox('cancel() deve mudar o status para "cancelado" e persistir o motivo informado, quando o pedido ainda não foi finalizado.')]
    public function test_cancel_transitions_an_unfinished_request_and_records_the_reason(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('updateStatus')
            ->once()
            ->with($rescueRequest, [
                'cancellation_reason' => 'Solicitante desistiu.',
                'status' => RescueRequestStatus::Cancelado,
            ])
            ->andReturn($rescueRequest);

        $rescueRequests->shouldReceive('freshWithOperator')
            ->once()
            ->andReturn($rescueRequest);

        $statusLogs->shouldReceive('create')
            ->once()
            ->with([
                'rescue_request_id' => $rescueRequest->id,
                'operator_id' => $operator->id,
                'previous_status' => RescueRequestStatus::Pendente,
                'new_status' => RescueRequestStatus::Cancelado,
            ])
            ->andReturn(\Mockery::mock(RescueStatusLog::class));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $service->cancel($rescueRequest, $operator, 'Solicitante desistiu.');
    }
}
