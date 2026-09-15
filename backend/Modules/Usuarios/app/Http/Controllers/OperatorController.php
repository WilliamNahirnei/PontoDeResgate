<?php

namespace Modules\Usuarios\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Usuarios\Http\Requests\Operator\StoreOperatorRequest;
use Modules\Usuarios\Http\Resources\UserResource;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Services\OperatorService;

class OperatorController extends Controller
{
    public function __construct(private OperatorService $service) {}

    /**
     * List operators, optionally filtered by name and/or email (admin master only).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $operators = $this->service->list(
            $request->only(['name', 'email']),
            $request->integer('per_page', 15),
        );

        return UserResource::collection($operators);
    }

    /**
     * Register a new operator (admin master only).
     */
    public function store(StoreOperatorRequest $request): JsonResponse
    {
        $operator = $this->service->register($request->validated());

        return response()->json(new UserResource($operator), 201);
    }

    /**
     * Deactivate an operator, revoking their access tokens (admin master only).
     */
    public function deactivate(User $operator): UserResource
    {
        return new UserResource($this->service->deactivate($operator));
    }

    /**
     * Reactivate a previously deactivated operator (admin master only).
     */
    public function activate(User $operator): UserResource
    {
        return new UserResource($this->service->activate($operator));
    }
}
