<?php

namespace Modules\Resgates\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Resgates\Http\Requests\RescueRequest\CancelRescueRequestRequest;
use Modules\Resgates\Http\Requests\RescueRequest\CompleteRescueRequestRequest;
use Modules\Resgates\Http\Requests\RescueRequest\IndexRescueRequestRequest;
use Modules\Resgates\Http\Requests\RescueRequest\StoreRescueRequestRequest;
use Modules\Resgates\Http\Resources\RescueRequestResource;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Services\RescueRequestService;

class RescueRequestController extends Controller
{
    public function __construct(private RescueRequestService $service) {}

    /**
     * Submit a new rescue request. Public endpoint — no authentication required.
     */
    public function store(StoreRescueRequestRequest $request): JsonResponse
    {
        $this->service->submit($request->validated());

        return response()->json([
            'message' => 'Pedido de socorro registrado com sucesso.',
        ], 201);
    }

    /**
     * List a page of rescue requests, optionally filtered and sorted (authenticated operators only).
     */
    public function index(IndexRescueRequestRequest $request): AnonymousResourceCollection
    {
        $rescueRequests = $this->service->list(
            $request->validated(),
            $request->validated('sort_by', 'created_at'),
            $request->validated('sort_direction', 'desc'),
            $request->validated('per_page') ?? IndexRescueRequestRequest::DEFAULT_PER_PAGE,
        );

        return RescueRequestResource::collection($rescueRequests);
    }

    /**
     * Assign the authenticated operator to a pending rescue request.
     */
    public function assume(Request $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        return new RescueRequestResource($this->service->assume($rescueRequest, $request->user()));
    }

    /**
     * Mark a rescue request that is in progress as concluded.
     */
    public function complete(CompleteRescueRequestRequest $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        return new RescueRequestResource(
            $this->service->complete($rescueRequest, $request->user(), $request->validated('completion_note'))
        );
    }

    /**
     * Cancel a rescue request that has not yet been finalized.
     */
    public function cancel(CancelRescueRequestRequest $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        return new RescueRequestResource(
            $this->service->cancel($rescueRequest, $request->user(), $request->validated('cancellation_reason'))
        );
    }
}
