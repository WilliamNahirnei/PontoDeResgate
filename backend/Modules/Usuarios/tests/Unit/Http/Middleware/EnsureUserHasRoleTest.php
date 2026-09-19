<?php

namespace Modules\Usuarios\Tests\Unit\Http\Middleware;

use Illuminate\Http\Request;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Http\Middleware\EnsureUserHasRole;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class EnsureUserHasRoleTest extends TestCase
{
    /**
     * @return array<string, array{0: UserRole, 1: array<int, string>}>
     */
    public static function allowedRoleCombinations(): array
    {
        return [
            'admin_master em rota exclusiva de admin_master' => [UserRole::AdminMaster, ['admin_master']],
            'operador em rota exclusiva de operador' => [UserRole::Operador, ['operador']],
            'admin_master em rota liberada para os dois papéis' => [UserRole::AdminMaster, ['operador', 'admin_master']],
            'operador em rota liberada para os dois papéis' => [UserRole::Operador, ['admin_master', 'operador']],
        ];
    }

    /**
     * @return array<string, array{0: UserRole, 1: array<int, string>}>
     */
    public static function blockedRoleCombinations(): array
    {
        return [
            'operador em rota exclusiva de admin_master' => [UserRole::Operador, ['admin_master']],
            'admin_master em rota exclusiva de operador' => [UserRole::AdminMaster, ['operador']],
        ];
    }

    /**
     * @param  array<int, string>  $roles
     */
    #[DataProvider('allowedRoleCombinations')]
    #[TestDox('handle() deve repassar a requisição adiante quando o papel do usuário está entre os papéis permitidos.')]
    public function test_passes_the_request_on_when_the_user_role_is_allowed(UserRole $userRole, array $roles): void
    {
        $request = $this->requestForUser(User::factory()->make(['role' => $userRole]));

        $response = (new EnsureUserHasRole)->handle($request, fn (Request $request) => response('passou'), ...$roles);

        $this->assertSame('passou', $response->getContent());
    }

    /**
     * @param  array<int, string>  $roles
     */
    #[DataProvider('blockedRoleCombinations')]
    #[TestDox('handle() deve bloquear com 403 quando o papel do usuário não está entre os papéis permitidos.')]
    public function test_aborts_with_403_when_the_user_role_is_not_allowed(UserRole $userRole, array $roles): void
    {
        $request = $this->requestForUser(User::factory()->make(['role' => $userRole]));

        try {
            (new EnsureUserHasRole)->handle($request, fn (Request $request) => response('passou'), ...$roles);
            $this->fail('Esperava que handle() lançasse uma HttpException (403).');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
            $this->assertSame('Você não tem permissão para acessar este recurso.', $exception->getMessage());
        }
    }

    #[TestDox('handle() deve bloquear com 403 quando não há usuário autenticado na requisição.')]
    public function test_aborts_with_403_when_there_is_no_authenticated_user(): void
    {
        $request = $this->requestForUser(null);

        try {
            (new EnsureUserHasRole)->handle($request, fn (Request $request) => response('passou'), 'admin_master');
            $this->fail('Esperava que handle() lançasse uma HttpException (403).');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
    }

    #[TestDox('handle() deve lançar ValueError quando o parâmetro do middleware não é um papel existente.')]
    public function test_throws_a_value_error_when_the_role_parameter_is_not_a_known_role(): void
    {
        $request = $this->requestForUser(User::factory()->adminMaster()->make());

        $this->expectException(\ValueError::class);

        (new EnsureUserHasRole)->handle($request, fn (Request $request) => response('passou'), 'papel_inexistente');
    }

    private function requestForUser(?User $user): Request
    {
        $request = Request::create('/api/recurso-protegido');
        $request->setUserResolver(fn () => $user);

        return $request;
    }
}
