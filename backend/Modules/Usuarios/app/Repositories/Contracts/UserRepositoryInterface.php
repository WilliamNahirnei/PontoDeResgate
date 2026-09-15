<?php

namespace Modules\Usuarios\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Usuarios\Models\User;

interface UserRepositoryInterface
{
    /**
     * Find a single user by their unique email address.
     */
    public function findByEmail(string $email): ?User;

    /**
     * Paginate users with the "operador" role, optionally filtered by name and/or email.
     *
     * @param  array<string, mixed>  $filters  Accepts the optional keys "name" and "email".
     */
    public function paginateOperators(array $filters, int $perPage): LengthAwarePaginator;

    /**
     * Persist a new user with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): User;

    /**
     * Update an existing user with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function update(User $user, array $attributes): User;

    /**
     * Revoke every Sanctum personal access token issued to the given user.
     */
    public function revokeTokens(User $user): void;
}
