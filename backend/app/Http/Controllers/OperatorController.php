<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Operator\StoreOperatorRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;

class OperatorController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $operators = User::query()
            ->where('role', UserRole::Operador)
            ->when(
                $request->filled('name'),
                fn ($query) => $query->where('name', 'like', '%'.$request->string('name').'%')
            )
            ->when(
                $request->filled('email'),
                fn ($query) => $query->where('email', 'like', '%'.$request->string('email').'%')
            )
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return UserResource::collection($operators);
    }

    public function store(StoreOperatorRequest $request): JsonResponse
    {
        $operator = User::create([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => Hash::make($request->validated('password')),
            'role' => UserRole::Operador,
        ]);

        return response()->json(new UserResource($operator), 201);
    }

    public function deactivate(User $operator): UserResource
    {
        abort_unless($operator->isOperador(), 404);

        $operator->update(['active' => false]);
        $operator->tokens()->delete();

        return new UserResource($operator);
    }

    public function activate(User $operator): UserResource
    {
        abort_unless($operator->isOperador(), 404);

        $operator->update(['active' => true]);

        return new UserResource($operator);
    }
}
