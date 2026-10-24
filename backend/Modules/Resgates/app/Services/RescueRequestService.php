<?php

namespace Modules\Resgates\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Repositories\Contracts\RescueRequestRepositoryInterface;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;
use Modules\Usuarios\Models\User;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RescueRequestService
{
    public function __construct(
        private RescueRequestRepositoryInterface $rescueRequests,
        private RescueStatusLogRepositoryInterface $statusLogs,
    ) {}

    /**
     * Register a new rescue request with the "pendente" status.
     *
     * @param  array<string, mixed>  $data
     */
    public function submit(array $data): RescueRequest
    {
        return $this->rescueRequests->create([
            ...$data,
            'status' => RescueRequestStatus::Pendente,
        ]);
    }

    /**
     * List a page of rescue requests matching the given filters, sorted by the given column/direction.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, RescueRequest>
     */
    public function list(array $filters, string $sortBy, string $sortDirection, int $perPage): LengthAwarePaginator
    {
        return $this->rescueRequests->paginateWithFilters($filters, $sortBy, $sortDirection, $perPage);
    }

    /**
     * Assign the given operator to a pending rescue request and mark it "em_resgate".
     *
     * @throws HttpException When the request is not pending (409).
     */
    public function assume(RescueRequest $rescueRequest, User $operator): RescueRequest
    {
        return $this->changeStatus(
            $rescueRequest,
            $operator,
            [RescueRequestStatus::Pendente],
            'Este pedido não está mais pendente e pode ter sido assumido por outro operador.',
            RescueRequestStatus::EmResgate,
            ['operator_id' => $operator->id],
        );
    }

    /**
     * Mark a rescue request that is currently "em_resgate" as "concluido", recording the optional note.
     *
     * @throws HttpException When the request is not in progress (409).
     */
    public function complete(RescueRequest $rescueRequest, User $operator, ?string $note = null): RescueRequest
    {
        // Uma observação só com espaços conta como não informada: nada é gravado.
        $note = trim((string) $note);

        return $this->changeStatus(
            $rescueRequest,
            $operator,
            [RescueRequestStatus::EmResgate],
            'Este pedido foi alterado por outro operador.',
            RescueRequestStatus::Concluido,
            $note === '' ? [] : ['completion_note' => $note],
        );
    }

    /**
     * Cancel a rescue request that has not yet been finalized, recording the given reason.
     *
     * @throws HttpException When the request is already concluído/cancelado (409).
     */
    public function cancel(RescueRequest $rescueRequest, User $operator, string $reason): RescueRequest
    {
        return $this->changeStatus(
            $rescueRequest,
            $operator,
            [RescueRequestStatus::Pendente, RescueRequestStatus::EmResgate],
            'Este pedido foi alterado por outro operador.',
            RescueRequestStatus::Cancelado,
            ['cancellation_reason' => $reason],
        );
    }

    /**
     * Update the rescue request's status and register the change in the audit log.
     *
     * The current status is checked against the row re-read with a lock inside the
     * transaction, not against the given model: it was loaded before the transaction
     * and may be stale when two operators act on the same request at the same time.
     *
     * @param  list<RescueRequestStatus>  $allowedStatuses
     * @param  array<string, mixed>  $extraAttributes
     *
     * @throws HttpException When the current status is not one of $allowedStatuses (409).
     */
    private function changeStatus(
        RescueRequest $rescueRequest,
        User $operator,
        array $allowedStatuses,
        string $notAllowedMessage,
        RescueRequestStatus $newStatus,
        array $extraAttributes = []
    ): RescueRequest {
        return DB::transaction(function () use ($rescueRequest, $operator, $allowedStatuses, $notAllowedMessage, $newStatus, $extraAttributes) {
            $rescueRequest = $this->rescueRequests->findForUpdate($rescueRequest);
            $previousStatus = $rescueRequest->status;

            abort_unless(in_array($previousStatus, $allowedStatuses, true), 409, $notAllowedMessage);

            $rescueRequest = $this->rescueRequests->updateStatus($rescueRequest, [
                ...$extraAttributes,
                'status' => $newStatus,
            ]);

            $this->statusLogs->create([
                'rescue_request_id' => $rescueRequest->id,
                'operator_id' => $operator->id,
                'previous_status' => $previousStatus,
                'new_status' => $newStatus,
            ]);

            return $this->rescueRequests->freshWithOperator($rescueRequest);
        });
    }
}
