<?php

namespace App\Http\Controllers;

use App\Enums\RescueRequestStatus;
use App\Http\Requests\RescueRequest\CancelRescueRequestRequest;
use App\Http\Requests\RescueRequest\StoreRescueRequestRequest;
use App\Http\Resources\RescueRequestResource;
use App\Models\RescueRequest;
use App\Models\RescueStatusLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RescueRequestController extends Controller
{
    public function store(StoreRescueRequestRequest $request): JsonResponse
    {
        RescueRequest::create([
            ...$request->validated(),
            'status' => RescueRequestStatus::Pendente,
        ]);

        return response()->json([
            'message' => 'Pedido de socorro registrado com sucesso.',
        ], 201);
    }

    public function index(): AnonymousResourceCollection
    {
        $rescueRequests = RescueRequest::query()
            ->with('operator')
            ->latest()
            ->get();

        return RescueRequestResource::collection($rescueRequests);
    }

    public function assume(Request $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        abort_if($rescueRequest->status !== RescueRequestStatus::Pendente, 409, 'Este pedido não está mais pendente.');

        $this->changeStatus($rescueRequest, $request->user(), RescueRequestStatus::EmResgate, [
            'operator_id' => $request->user()->id,
        ]);

        return new RescueRequestResource($rescueRequest->fresh('operator'));
    }

    public function complete(Request $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        abort_if($rescueRequest->status !== RescueRequestStatus::EmResgate, 409, 'Este pedido não está em resgate.');

        $this->changeStatus($rescueRequest, $request->user(), RescueRequestStatus::Concluido);

        return new RescueRequestResource($rescueRequest->fresh('operator'));
    }

    public function cancel(CancelRescueRequestRequest $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        abort_if(
            in_array($rescueRequest->status, [RescueRequestStatus::Concluido, RescueRequestStatus::Cancelado], true),
            409,
            'Este pedido já foi finalizado e não pode ser cancelado.'
        );

        $this->changeStatus($rescueRequest, $request->user(), RescueRequestStatus::Cancelado, [
            'cancellation_reason' => $request->validated('cancellation_reason'),
        ]);

        return new RescueRequestResource($rescueRequest->fresh('operator'));
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
    ): void {
        $previousStatus = $rescueRequest->status;

        $rescueRequest->update([
            ...$extraAttributes,
            'status' => $newStatus,
        ]);

        RescueStatusLog::create([
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => $previousStatus,
            'new_status' => $newStatus,
        ]);
    }
}
