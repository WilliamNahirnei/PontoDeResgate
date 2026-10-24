<?php

namespace Modules\Resgates\Tests\Unit\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Resgates\Repositories\Contracts\RescueRequestRepositoryInterface;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;
use Modules\Resgates\Repositories\RescueRequestRepository;
use Modules\Resgates\Repositories\RescueStatusLogRepository;
use Modules\Resgates\Services\RescueRequestService;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RescueRequestServiceTest extends TestCase
{
    use LazilyRefreshDatabase, MockeryPHPUnitIntegration;

    /**
     * @return array<string, array{0: RescueRequestStatus}>
     */
    public static function finalizedStatuses(): array
    {
        return [
            'concluido' => [RescueRequestStatus::Concluido],
            'cancelado' => [RescueRequestStatus::Cancelado],
        ];
    }

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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
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

    #[TestDox('list() deve repassar filtros, ordenação e itens por página ao Repository e devolver a página dele.')]
    public function test_list_delegates_filters_sorting_and_per_page_to_the_repository(): void
    {
        $page = new LengthAwarePaginator([], 0, 20);

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('paginateWithFilters')
            ->once()
            ->with(['status' => 'pendente', 'min_total_people' => 3], 'total_people', 'asc', 20)
            ->andReturn($page);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $result = $service->list(['status' => 'pendente', 'min_total_people' => 3], 'total_people', 'asc', 20);

        $this->assertSame($page, $result);
    }

    #[TestDox('assume() deve devolver o pedido recarregado pelo Repository.')]
    public function test_assume_returns_the_request_reloaded_by_the_repository(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $operator = User::factory()->create();
        $reloaded = RescueRequest::factory()->emResgate()->make();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('updateStatus')->once()->andReturn($rescueRequest);
        $rescueRequests->shouldReceive('freshWithOperator')->once()->with($rescueRequest)->andReturn($reloaded);
        $statusLogs->shouldReceive('create')->once()->andReturn(\Mockery::mock(RescueStatusLog::class));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $result = $service->assume($rescueRequest, $operator);

        $this->assertSame($reloaded, $result);
    }

    #[DataProvider('finalizedStatuses')]
    #[TestDox('assume() deve rejeitar um pedido já finalizado (concluído ou cancelado), sem alterar o status no banco.')]
    public function test_assume_rejects_a_finalized_request(RescueRequestStatus $status): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => $status]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->assume($rescueRequest, $operator);
            $this->fail('Esperava que assume() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
            $this->assertSame('Este pedido não está mais pendente e pode ter sido assumido por outro operador.', $exception->getMessage());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => $status->value,
        ]);
    }

    #[TestDox('complete() deve mudar o status para "concluido" e registrar no log quem concluiu, quando o pedido está "em_resgate".')]
    public function test_complete_transitions_an_in_progress_request_to_concluido(): void
    {
        $assignedOperator = User::factory()->create();
        $completingOperator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $assignedOperator->id]);
        $reloaded = RescueRequest::factory()->make(['status' => RescueRequestStatus::Concluido]);

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('updateStatus')
            ->once()
            ->with($rescueRequest, ['status' => RescueRequestStatus::Concluido])
            ->andReturn($rescueRequest);

        $rescueRequests->shouldReceive('freshWithOperator')
            ->once()
            ->with($rescueRequest)
            ->andReturn($reloaded);

        $statusLogs->shouldReceive('create')
            ->once()
            ->with([
                'rescue_request_id' => $rescueRequest->id,
                'operator_id' => $completingOperator->id,
                'previous_status' => RescueRequestStatus::EmResgate,
                'new_status' => RescueRequestStatus::Concluido,
            ])
            ->andReturn(\Mockery::mock(RescueStatusLog::class));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $result = $service->complete($rescueRequest, $completingOperator);

        $this->assertSame($reloaded, $result);
    }

    #[DataProvider('finalizedStatuses')]
    #[TestDox('complete() deve rejeitar um pedido já finalizado (concluído ou cancelado), sem alterar o status no banco.')]
    public function test_complete_rejects_a_finalized_request(RescueRequestStatus $status): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => $status]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        try {
            $service->complete($rescueRequest, $operator);
            $this->fail('Esperava que complete() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
            $this->assertSame('Este pedido foi alterado por outro operador.', $exception->getMessage());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => $status->value,
        ]);
    }

    #[TestDox('cancel() deve registrar "em_resgate" como status anterior quando cancela um pedido em andamento.')]
    public function test_cancel_transitions_an_in_progress_request_and_logs_em_resgate_as_the_previous_status(): void
    {
        $rescueRequest = RescueRequest::factory()->emResgate()->create();
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);
        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);

        $rescueRequests->shouldReceive('updateStatus')
            ->once()
            ->with($rescueRequest, [
                'cancellation_reason' => 'Equipe sem acesso ao local.',
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
                'previous_status' => RescueRequestStatus::EmResgate,
                'new_status' => RescueRequestStatus::Cancelado,
            ])
            ->andReturn(\Mockery::mock(RescueStatusLog::class));

        $service = new RescueRequestService($rescueRequests, $statusLogs);

        $service->cancel($rescueRequest, $operator, 'Equipe sem acesso ao local.');
    }

    #[TestDox('cancel() deve informar na mensagem de erro que o pedido foi alterado por outro operador.')]
    public function test_cancel_rejection_says_that_the_request_was_changed_by_another_operator(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido]);
        $operator = User::factory()->create();

        $rescueRequests = \Mockery::mock(RescueRequestRepositoryInterface::class);
        $rescueRequests->shouldReceive('findForUpdate')->once()->with($rescueRequest)->andReturn($rescueRequest);

        $service = new RescueRequestService(
            $rescueRequests,
            \Mockery::mock(RescueStatusLogRepositoryInterface::class),
        );

        try {
            $service->cancel($rescueRequest, $operator, 'Solicitante desistiu.');
            $this->fail('Esperava que cancel() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame('Este pedido foi alterado por outro operador.', $exception->getMessage());
        }
    }

    #[TestDox('A mudança de status deve ser desfeita no banco quando o registro no log de auditoria falha (transação).')]
    public function test_status_change_is_rolled_back_when_the_audit_log_fails(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $operator = User::factory()->create();

        $statusLogs = \Mockery::mock(RescueStatusLogRepositoryInterface::class);
        $statusLogs->shouldReceive('create')
            ->once()
            ->andThrow(new \RuntimeException('Falha ao gravar o log de auditoria.'));

        $service = new RescueRequestService(new RescueRequestRepository, $statusLogs);

        try {
            $service->assume($rescueRequest, $operator);
            $this->fail('Esperava que assume() propagasse a falha do log de auditoria.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Falha ao gravar o log de auditoria.', $exception->getMessage());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Pendente->value,
            'operator_id' => null,
        ]);
    }

    /**
     * Simula outro operador alterando o pedido depois que ele foi carregado:
     * o objeto recebido pelo service continua com o status antigo, e só o
     * banco tem o novo. É o que acontece quando duas requisições chegam ao
     * mesmo tempo (route model binding carrega o pedido antes da transação).
     *
     * @param  array<string, mixed>  $attributes
     */
    private function changeBehindTheLoadedModel(RescueRequest $rescueRequest, array $attributes): void
    {
        RescueRequest::query()->whereKey($rescueRequest->id)->update($attributes);
    }

    #[TestDox('assume() deve rejeitar um pedido que outro operador assumiu depois de ele ser carregado, sem sobrescrever o operador responsável nem gravar log.')]
    public function test_assume_rejects_a_request_assumed_by_another_operator_after_it_was_loaded(): void
    {
        $rescueRequest = RescueRequest::factory()->create(['status' => RescueRequestStatus::Pendente]);
        $firstOperator = User::factory()->create();
        $secondOperator = User::factory()->create();
        $this->changeBehindTheLoadedModel($rescueRequest, [
            'status' => RescueRequestStatus::EmResgate,
            'operator_id' => $firstOperator->id,
        ]);

        $service = new RescueRequestService(new RescueRequestRepository, new RescueStatusLogRepository);

        try {
            $service->assume($rescueRequest, $secondOperator);
            $this->fail('Esperava que assume() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::EmResgate->value,
            'operator_id' => $firstOperator->id,
        ]);
        $this->assertDatabaseMissing('rescue_status_logs', ['rescue_request_id' => $rescueRequest->id]);
    }

    #[TestDox('complete() deve rejeitar um pedido que outro operador cancelou depois de ele ser carregado, sem alterar o status nem gravar log.')]
    public function test_complete_rejects_a_request_cancelled_by_another_operator_after_it_was_loaded(): void
    {
        $firstOperator = User::factory()->create();
        $secondOperator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create([
            'status' => RescueRequestStatus::EmResgate,
            'operator_id' => $firstOperator->id,
        ]);
        $this->changeBehindTheLoadedModel($rescueRequest, [
            'status' => RescueRequestStatus::Cancelado,
            'cancellation_reason' => 'Solicitante desistiu.',
        ]);

        $service = new RescueRequestService(new RescueRequestRepository, new RescueStatusLogRepository);

        try {
            $service->complete($rescueRequest, $secondOperator);
            $this->fail('Esperava que complete() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Cancelado->value,
        ]);
        $this->assertDatabaseMissing('rescue_status_logs', ['rescue_request_id' => $rescueRequest->id]);
    }

    #[TestDox('cancel() deve rejeitar um pedido que outro operador concluiu depois de ele ser carregado, sem alterar o status nem gravar log.')]
    public function test_cancel_rejects_a_request_concluded_by_another_operator_after_it_was_loaded(): void
    {
        $firstOperator = User::factory()->create();
        $secondOperator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create([
            'status' => RescueRequestStatus::EmResgate,
            'operator_id' => $firstOperator->id,
        ]);
        $this->changeBehindTheLoadedModel($rescueRequest, ['status' => RescueRequestStatus::Concluido]);

        $service = new RescueRequestService(new RescueRequestRepository, new RescueStatusLogRepository);

        try {
            $service->cancel($rescueRequest, $secondOperator, 'Solicitante desistiu.');
            $this->fail('Esperava que cancel() lançasse uma HttpException (409).');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::Concluido->value,
            'cancellation_reason' => null,
        ]);
        $this->assertDatabaseMissing('rescue_status_logs', ['rescue_request_id' => $rescueRequest->id]);
    }
}
