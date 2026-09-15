<?php

namespace Modules\Usuarios\Services;

use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;

class AuthService
{
    public function __construct(private UserRepositoryInterface $users) {}

    /**
     * Authenticate a user by email/password and issue a new Sanctum API token.
     *
     * @return array{token: string, user: User}
     *
     * @throws ValidationException When the credentials do not match, or the user is deactivated.
     */
    public function login(string $email, string $password): array
    {
        $user = $this->users->findByEmail($email);

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['As credenciais informadas não conferem.'],
            ]);
        }

        if (! $user->active) {
            throw ValidationException::withMessages([
                'email' => ['Este usuário foi desativado.'],
            ]);
        }

        return [
            'token' => $user->createToken('painel-operador')->plainTextToken,
            'user' => $user,
        ];
    }

    /**
     * Revoke the access token used to authenticate the current request.
     */
    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
    }
}
