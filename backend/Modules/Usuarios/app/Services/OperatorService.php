<?php

namespace Modules\Usuarios\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OperatorService
{
    public function __construct(private UserRepositoryInterface $users) {}

    /**
     * List operators, optionally filtered by name and/or email, paginated.
     *
     * @param  array<string, mixed>  $filters  Accepts the optional keys "name" and "email".
     */
    public function list(array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->users->paginateOperators($filters, $perPage);
    }

    /**
     * Register a new operator with a hashed password and the fixed "operador" role.
     *
     * @param  array<string, mixed>  $data  Expects the keys "name", "email" and "password".
     */
    public function register(array $data): User
    {
        return $this->users->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => UserRole::Operador,
        ]);
    }

    /**
     * Deactivate an operator and revoke every access token issued to them.
     *
     * @throws HttpException When the given user is not an operator (404).
     */
    public function deactivate(User $operator): User
    {
        abort_unless($operator->isOperador(), 404);

        $this->users->revokeTokens($operator);

        return $this->users->update($operator, ['active' => false]);
    }

    /**
     * Reactivate a previously deactivated operator.
     *
     * @throws HttpException When the given user is not an operator (404).
     */
    public function activate(User $operator): User
    {
        abort_unless($operator->isOperador(), 404);

        return $this->users->update($operator, ['active' => true]);
    }
}
