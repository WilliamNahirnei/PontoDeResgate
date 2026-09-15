<?php

namespace Modules\Usuarios\Tests\Unit\Repositories;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\UserRepository;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class UserRepositoryTest extends TestCase
{
    use LazilyRefreshDatabase;

    private UserRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = new UserRepository;
    }

    #[TestDox('findByEmail() deve retornar o usuário correspondente ao e-mail informado.')]
    public function test_find_by_email_returns_the_matching_user(): void
    {
        $user = User::factory()->create(['email' => 'existe@pontoderesgate.local']);

        $found = $this->repository->findByEmail('existe@pontoderesgate.local');

        $this->assertNotNull($found);
        $this->assertTrue($found->is($user));
    }

    #[TestDox('findByEmail() deve retornar null quando nenhum usuário tem o e-mail informado.')]
    public function test_find_by_email_returns_null_when_no_user_matches(): void
    {
        $this->assertNull($this->repository->findByEmail('nao-existe@pontoderesgate.local'));
    }

    #[TestDox('paginateOperators() deve listar apenas usuários com o papel operador, nunca admin_master.')]
    public function test_paginate_operators_only_includes_users_with_the_operator_role(): void
    {
        User::factory()->count(2)->create();
        User::factory()->adminMaster()->create();

        $result = $this->repository->paginateOperators([], 15);

        $this->assertSame(2, $result->total());
        $this->assertTrue($result->every(fn (User $user) => $user->role === UserRole::Operador));
    }

    #[TestDox('paginateOperators() deve filtrar operadores pelo nome informado.')]
    public function test_paginate_operators_filters_by_name(): void
    {
        User::factory()->create(['name' => 'Ana Beatriz Lima']);
        User::factory()->create(['name' => 'Bruno Carvalho']);

        $result = $this->repository->paginateOperators(['name' => 'Ana'], 15);

        $this->assertSame(1, $result->total());
        $this->assertSame('Ana Beatriz Lima', $result->first()->name);
    }

    #[TestDox('paginateOperators() deve filtrar operadores pelo e-mail informado.')]
    public function test_paginate_operators_filters_by_email(): void
    {
        User::factory()->create(['email' => 'ana.lima@pontoderesgate.local']);
        User::factory()->create(['email' => 'bruno.carvalho@pontoderesgate.local']);

        $result = $this->repository->paginateOperators(['email' => 'ana.lima'], 15);

        $this->assertSame(1, $result->total());
        $this->assertSame('ana.lima@pontoderesgate.local', $result->first()->email);
    }

    #[TestDox('paginateOperators() deve respeitar a quantidade de itens por página.')]
    public function test_paginate_operators_respects_the_per_page_value(): void
    {
        User::factory()->count(3)->create();

        $result = $this->repository->paginateOperators([], 2);

        $this->assertCount(2, $result->items());
        $this->assertSame(3, $result->total());
    }

    #[TestDox('create() deve persistir um novo usuário com os atributos informados.')]
    public function test_create_persists_a_new_user(): void
    {
        $user = $this->repository->create([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::Operador,
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'novo.operador@pontoderesgate.local',
        ]);
    }

    #[TestDox('update() deve persistir os atributos informados no usuário existente.')]
    public function test_update_persists_the_given_attributes(): void
    {
        $user = User::factory()->create(['active' => true]);

        $updated = $this->repository->update($user, ['active' => false]);

        $this->assertFalse($updated->active);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'active' => false]);
    }

    #[TestDox('revokeTokens() deve apagar todos os tokens de acesso do usuário.')]
    public function test_revoke_tokens_deletes_every_token_of_the_user(): void
    {
        $user = User::factory()->create();
        $user->createToken('token-1');
        $user->createToken('token-2');

        $this->repository->revokeTokens($user);

        $this->assertSame(0, $user->tokens()->count());
    }
}
