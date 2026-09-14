<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Operator\StoreOperatorRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class OperatorController extends Controller
{
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
}
