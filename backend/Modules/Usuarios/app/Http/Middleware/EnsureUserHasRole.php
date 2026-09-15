<?php

namespace Modules\Usuarios\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\Usuarios\Enums\UserRole;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
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
