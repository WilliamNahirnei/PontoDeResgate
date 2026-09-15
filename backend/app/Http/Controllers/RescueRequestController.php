<?php

namespace App\Http\Controllers;

use App\Enums\RescueRequestStatus;
use App\Http\Requests\RescueRequest\CancelRescueRequestRequest;
use App\Http\Requests\RescueRequest\IndexRescueRequestRequest;
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

    /**
     * Quantity columns that accept a "min_<column>" filter, keyed by the query parameter name.
     *
     * @var array<string, string>
     */
    private const QUANTITY_FILTERS = [
        'min_total_people' => 'total_people',
        'min_men_count' => 'men_count',
        'min_women_count' => 'women_count',
        'min_children_count' => 'children_count',
        'min_elderly_count' => 'elderly_count',
        'min_animals_count' => 'animals_count',
    ];

    public function index(IndexRescueRequestRequest $request): AnonymousResourceCollection
    {
        $sortBy = $request->validated('sort_by', 'created_at');
        $sortDirection = $request->validated('sort_direction', 'desc');

        $query = RescueRequest::query()
            ->with('operator')
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->validated('status'))
            );

        foreach (self::QUANTITY_FILTERS as $param => $column) {
            $query->when(
                $request->filled($param),
                // Só considera pedidos com a informação preenchida: um pedido sem
                // essa quantidade informada não pode "satisfazer" um filtro mínimo.
                fn ($query) => $query->whereNotNull($column)->where($column, '>=', $request->validated($param))
            );
        }

        $rescueRequests = $query
            // Coloca os pedidos sem a informação preenchida sempre por último,
            // independente da direção escolhida para a ordenação.
            ->orderByRaw("{$sortBy} IS NULL")
            ->orderBy($sortBy, $sortDirection)
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
