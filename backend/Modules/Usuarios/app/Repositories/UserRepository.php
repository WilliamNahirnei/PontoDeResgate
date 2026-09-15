<?php

namespace Modules\Usuarios\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;

class UserRepository implements UserRepositoryInterface
{
    /**
     * Find a single user by their unique email address.
     */
    public function findByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }

    /**
     * Paginate users with the "operador" role, optionally filtered by name and/or email.
     *
     * @param  array<string, mixed>  $filters  Accepts the optional keys "name" and "email".
     */
    public function paginateOperators(array $filters, int $perPage): LengthAwarePaginator
    {
        return User::query()
            ->where('role', UserRole::Operador)
            ->when(
                ! empty($filters['name']),
                fn ($query) => $query->where('name', 'like', '%'.$filters['name'].'%')
            )
            ->when(
                ! empty($filters['email']),
                fn ($query) => $query->where('email', 'like', '%'.$filters['email'].'%')
            )
            ->orderBy('name')
            ->paginate($perPage);
    }

    /**
     * Persist a new user with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): User
    {
        return User::create($attributes);
    }

    /**
     * Update an existing user with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function update(User $user, array $attributes): User
    {
        $user->update($attributes);

        return $user;
    }

    /**
     * Revoke every Sanctum personal access token issued to the given user.
     */
    public function revokeTokens(User $user): void
    {
        $user->tokens()->delete();
    }
}
