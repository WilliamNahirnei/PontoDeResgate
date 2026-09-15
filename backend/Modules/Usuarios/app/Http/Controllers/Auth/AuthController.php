<?php

namespace Modules\Usuarios\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Usuarios\Http\Requests\Auth\LoginRequest;
use Modules\Usuarios\Http\Resources\UserResource;
use Modules\Usuarios\Services\AuthService;

class AuthController extends Controller
{
    public function __construct(private AuthService $service) {}

    /**
     * Authenticate an operator/admin master and return a new API token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->service->login(...$request->validated());

        return response()->json([
            'token' => $result['token'],
            'user' => new UserResource($result['user']),
        ]);
    }

    /**
     * Revoke the token used to authenticate the current request.
     */
    public function logout(Request $request): JsonResponse
    {
        $this->service->logout($request->user());

        return response()->json(null, 204);
    }

    /**
     * Return the currently authenticated user.
     */
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }
}
