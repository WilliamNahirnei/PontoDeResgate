<?php

namespace Modules\Usuarios\Tests\Unit\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;
use Modules\Usuarios\Services\OperatorService;
use PHPUnit\Framework\Attributes\TestDox;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class OperatorServiceTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    #[TestDox('list() deve repassar os filtros e a quantidade por página ao Repository e devolver o paginador dele.')]
    public function test_list_delegates_filters_and_per_page_to_the_repository(): void
    {
        $paginator = new LengthAwarePaginator([], 0, 25);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('paginateOperators')
            ->once()
            ->with(['name' => 'Ana', 'email' => 'ana@pontoderesgate.local'], 25)
            ->andReturn($paginator);

        $service = new OperatorService($users);

        $result = $service->list(['name' => 'Ana', 'email' => 'ana@pontoderesgate.local'], 25);

        $this->assertSame($paginator, $result);
    }

    #[TestDox('register() deve gravar a senha hasheada, nunca em texto puro.')]
    public function test_register_hashes_the_password_before_persisting(): void
    {
        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('create')
            ->once()
            ->with(\Mockery::on(fn (array $attributes) => $attributes['password'] !== 'senha-valida-123'
                && Hash::check('senha-valida-123', $attributes['password'])
            ))
            ->andReturn(User::factory()->make());

        $service = new OperatorService($users);

        $service->register([
            'name' => 'Novo Operador',
            'email' => 'novo@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ]);
    }

    #[TestDox('register() deve fixar o papel "operador", ignorando qualquer papel informado nos dados.')]
    public function test_register_forces_the_operator_role_regardless_of_input(): void
    {
        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('create')
            ->once()
            ->with(\Mockery::on(fn (array $attributes) => $attributes['role'] === UserRole::Operador))
            ->andReturn(User::factory()->make());

        $service = new OperatorService($users);

        $service->register([
            'name' => 'Novo Operador',
            'email' => 'novo@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::AdminMaster,
        ]);
    }

    #[TestDox('register() deve repassar ao Repository apenas nome, e-mail, senha e papel, descartando campos extras.')]
    public function test_register_passes_only_the_expected_attributes_to_the_repository(): void
    {
        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('create')
            ->once()
            ->with(\Mockery::on(fn (array $attributes) => array_keys($attributes) === ['name', 'email', 'password', 'role']
                && $attributes['name'] === 'Novo Operador'
                && $attributes['email'] === 'novo@pontoderesgate.local'
            ))
            ->andReturn(User::factory()->make());

        $service = new OperatorService($users);

        $service->register([
            'name' => 'Novo Operador',
            'email' => 'novo@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'active' => false,
        ]);
    }

    #[TestDox('register() deve devolver o usuário criado pelo Repository.')]
    public function test_register_returns_the_user_created_by_the_repository(): void
    {
        $created = User::factory()->make();

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('create')->once()->andReturn($created);

        $service = new OperatorService($users);

        $result = $service->register([
            'name' => 'Novo Operador',
            'email' => 'novo@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ]);

        $this->assertSame($created, $result);
    }

    #[TestDox('deactivate() deve revogar os tokens e depois marcar o operador como inativo.')]
    public function test_deactivate_revokes_tokens_and_then_marks_the_operator_inactive(): void
    {
        $operator = User::factory()->make();
        $deactivated = User::factory()->inactive()->make();

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('revokeTokens')
            ->once()
            ->with($operator)
            ->ordered();
        $users->shouldReceive('update')
            ->once()
            ->with($operator, ['active' => false])
            ->ordered()
            ->andReturn($deactivated);

        $service = new OperatorService($users);

        $result = $service->deactivate($operator);

        $this->assertSame($deactivated, $result);
    }

    #[TestDox('deactivate() deve rejeitar um usuário que não é operador com 404, sem revogar tokens nem alterá-lo.')]
    public function test_deactivate_rejects_a_user_that_is_not_an_operator(): void
    {
        $adminMaster = User::factory()->adminMaster()->make();

        $service = new OperatorService(\Mockery::mock(UserRepositoryInterface::class));

        try {
            $service->deactivate($adminMaster);
            $this->fail('Esperava que deactivate() lançasse uma HttpException (404).');
        } catch (HttpException $exception) {
            $this->assertSame(404, $exception->getStatusCode());
        }
    }

    #[TestDox('activate() deve marcar o operador como ativo.')]
    public function test_activate_marks_the_operator_active(): void
    {
        $operator = User::factory()->inactive()->make();
        $activated = User::factory()->make();

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('update')
            ->once()
            ->with($operator, ['active' => true])
            ->andReturn($activated);

        $service = new OperatorService($users);

        $result = $service->activate($operator);

        $this->assertSame($activated, $result);
    }

    #[TestDox('activate() deve rejeitar um usuário que não é operador com 404, sem alterá-lo.')]
    public function test_activate_rejects_a_user_that_is_not_an_operator(): void
    {
        $adminMaster = User::factory()->adminMaster()->inactive()->make();

        $service = new OperatorService(\Mockery::mock(UserRepositoryInterface::class));

        try {
            $service->activate($adminMaster);
            $this->fail('Esperava que activate() lançasse uma HttpException (404).');
        } catch (HttpException $exception) {
            $this->assertSame(404, $exception->getStatusCode());
        }
    }
}
