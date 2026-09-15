<?php

namespace Modules\Usuarios\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Usuarios\Enums\UserRole;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class EnsureUserHasRole
{
    /**
     * Abort with a 403 unless the authenticated user has one of the given roles.
     *
     * @param  string  ...$roles  One or more {@see UserRole} values (e.g. "admin_master", "operador").
     *
     * @throws HttpException When there is no user, or their role is not allowed (403).
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        $allowedRoles = array_map(fn (string $role) => UserRole::from($role), $roles);

        if (! $user || ! in_array($user->role, $allowedRoles, true)) {
            abort(403, 'Você não tem permissão para acessar este recurso.');
        }

        return $next($request);
    }
}
