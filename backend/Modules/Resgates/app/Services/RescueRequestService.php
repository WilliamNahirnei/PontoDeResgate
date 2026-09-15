<?php

namespace Modules\Resgates\Services;

use Illuminate\Database\Eloquent\Collection;
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
     * List rescue requests matching the given filters, sorted by the given column/direction.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, RescueRequest>
     */
    public function list(array $filters, string $sortBy, string $sortDirection): Collection
    {
        return $this->rescueRequests->listWithFilters($filters, $sortBy, $sortDirection);
    }

    /**
     * Assign the given operator to a pending rescue request and mark it "em_resgate".
     *
     * @throws HttpException When the request is not pending (409).
     */
    public function assume(RescueRequest $rescueRequest, User $operator): RescueRequest
    {
        abort_if($rescueRequest->status !== RescueRequestStatus::Pendente, 409, 'Este pedido não está mais pendente.');

        return $this->changeStatus($rescueRequest, $operator, RescueRequestStatus::EmResgate, [
            'operator_id' => $operator->id,
        ]);
    }

    /**
     * Mark a rescue request that is currently "em_resgate" as "concluido".
     *
     * @throws HttpException When the request is not in progress (409).
     */
    public function complete(RescueRequest $rescueRequest, User $operator): RescueRequest
    {
        abort_if($rescueRequest->status !== RescueRequestStatus::EmResgate, 409, 'Este pedido não está em resgate.');

        return $this->changeStatus($rescueRequest, $operator, RescueRequestStatus::Concluido);
    }

    /**
     * Cancel a rescue request that has not yet been finalized, recording the given reason.
     *
     * @throws HttpException When the request is already concluído/cancelado (409).
     */
    public function cancel(RescueRequest $rescueRequest, User $operator, string $reason): RescueRequest
    {
        abort_if(
            in_array($rescueRequest->status, [RescueRequestStatus::Concluido, RescueRequestStatus::Cancelado], true),
            409,
            'Este pedido já foi finalizado e não pode ser cancelado.'
        );

        return $this->changeStatus($rescueRequest, $operator, RescueRequestStatus::Cancelado, [
            'cancellation_reason' => $reason,
        ]);
    }

    /**
     * Update the rescue request's status and register the change in the audit log.
     *
     * @param  array<string, mixed>  $extraAttributes
     */
    private function changeStatus(
        RescueRequest $rescueRequest,
        User $operator,
        RescueRequestStatus $newStatus,
        array $extraAttributes = []
    ): RescueRequest {
        return DB::transaction(function () use ($rescueRequest, $operator, $newStatus, $extraAttributes) {
            $previousStatus = $rescueRequest->status;

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
