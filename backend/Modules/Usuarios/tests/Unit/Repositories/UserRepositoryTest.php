<?php

namespace Modules\Usuarios\Tests\Unit\Repositories;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
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

    #[TestDox('findByEmail() não deve considerar correspondência parcial de e-mail.')]
    public function test_find_by_email_does_not_match_a_partial_email(): void
    {
        User::factory()->create(['email' => 'ana.lima@pontoderesgate.local']);

        $this->assertNull($this->repository->findByEmail('ana.lima'));
    }

    #[TestDox('paginateOperators() deve devolver uma página vazia quando não existe nenhum operador.')]
    public function test_paginate_operators_returns_an_empty_page_when_there_are_no_operators(): void
    {
        User::factory()->adminMaster()->create();

        $result = $this->repository->paginateOperators([], 15);

        $this->assertSame(0, $result->total());
        $this->assertCount(0, $result->items());
    }

    #[TestDox('paginateOperators() deve devolver o único operador existente.')]
    public function test_paginate_operators_returns_the_single_existing_operator(): void
    {
        $operator = User::factory()->create();

        $result = $this->repository->paginateOperators([], 15);

        $this->assertSame(1, $result->total());
        $this->assertTrue($result->first()->is($operator));
    }

    #[TestDox('paginateOperators() deve ordenar os operadores pelo nome em ordem crescente.')]
    public function test_paginate_operators_orders_by_name_ascending(): void
    {
        User::factory()->create(['name' => 'Carla Dias']);
        User::factory()->create(['name' => 'Ana Lima']);
        User::factory()->create(['name' => 'Bruno Costa']);

        $result = $this->repository->paginateOperators([], 15);

        $this->assertSame(['Ana Lima', 'Bruno Costa', 'Carla Dias'], $result->pluck('name')->all());
    }

    #[TestDox('paginateOperators() deve combinar os filtros de nome e e-mail como interseção, não como união.')]
    public function test_paginate_operators_combines_name_and_email_filters_as_an_intersection(): void
    {
        User::factory()->create(['name' => 'Ana Lima', 'email' => 'ana.lima@pontoderesgate.local']);
        User::factory()->create(['name' => 'Ana Souza', 'email' => 'souza@pontoderesgate.local']);
        User::factory()->create(['name' => 'Bruno Souza', 'email' => 'bruno.souza@pontoderesgate.local']);

        $result = $this->repository->paginateOperators(['name' => 'Ana', 'email' => 'souza'], 15);

        $this->assertSame(1, $result->total());
        $this->assertSame('Ana Souza', $result->first()->name);
    }

    #[TestDox('paginateOperators() deve devolver uma página vazia, sem erro, quando nenhum operador bate com o filtro.')]
    public function test_paginate_operators_returns_an_empty_page_when_no_operator_matches_the_filter(): void
    {
        User::factory()->create(['name' => 'Ana Lima']);

        $result = $this->repository->paginateOperators(['name' => 'Zeca'], 15);

        $this->assertSame(0, $result->total());
        $this->assertCount(0, $result->items());
    }

    #[TestDox('paginateOperators() deve ignorar filtros informados como string vazia.')]
    public function test_paginate_operators_ignores_empty_string_filters(): void
    {
        User::factory()->count(2)->create();

        $result = $this->repository->paginateOperators(['name' => '', 'email' => ''], 15);

        $this->assertSame(2, $result->total());
    }

    #[TestDox('paginateOperators() não deve incluir um admin_master cujo nome bate com o filtro informado.')]
    public function test_paginate_operators_excludes_an_admin_master_matching_the_name_filter(): void
    {
        User::factory()->create(['name' => 'Ana Operadora']);
        User::factory()->adminMaster()->create(['name' => 'Ana Administradora']);

        $result = $this->repository->paginateOperators(['name' => 'Ana'], 15);

        $this->assertSame(1, $result->total());
        $this->assertSame('Ana Operadora', $result->first()->name);
    }

    #[TestDox('paginateOperators() deve devolver os operadores restantes na segunda página.')]
    public function test_paginate_operators_returns_the_remaining_operators_on_the_second_page(): void
    {
        User::factory()->create(['name' => 'Ana Lima']);
        User::factory()->create(['name' => 'Bruno Costa']);
        User::factory()->create(['name' => 'Carla Dias']);
        request()->merge(['page' => 2]);

        $result = $this->repository->paginateOperators([], 2);

        $this->assertSame(3, $result->total());
        $this->assertSame(['Carla Dias'], $result->pluck('name')->all());
    }

    #[TestDox('paginateOperators() deve devolver uma página vazia quando a página pedida passa do total de resultados.')]
    public function test_paginate_operators_returns_an_empty_page_beyond_the_last_page(): void
    {
        User::factory()->count(2)->create();
        request()->merge(['page' => 5]);

        $result = $this->repository->paginateOperators([], 2);

        $this->assertSame(2, $result->total());
        $this->assertCount(0, $result->items());
    }

    #[TestDox('create() deve persistir o papel admin_master informado.')]
    public function test_create_persists_the_admin_master_role(): void
    {
        $user = $this->repository->create([
            'name' => 'Admin Master',
            'email' => 'admin@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::AdminMaster,
        ]);

        $this->assertSame(UserRole::AdminMaster, $user->fresh()->role);
    }

    #[TestDox('create() deve gravar o usuário como ativo quando "active" não é informado.')]
    public function test_create_defaults_the_user_to_active_when_active_is_omitted(): void
    {
        $user = $this->repository->create([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::Operador,
        ]);

        $this->assertTrue($user->fresh()->active);
    }

    #[TestDox('create() deve persistir o usuário como inativo quando "active" é informado como false.')]
    public function test_create_persists_an_explicitly_inactive_user(): void
    {
        $user = $this->repository->create([
            'name' => 'Operador Inativo',
            'email' => 'inativo@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::Operador,
            'active' => false,
        ]);

        $this->assertFalse($user->fresh()->active);
    }

    #[TestDox('create() deve gravar a senha hasheada, nunca em texto puro.')]
    public function test_create_stores_the_password_hashed(): void
    {
        $user = $this->repository->create([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::Operador,
        ]);

        $storedPassword = $user->fresh()->password;

        $this->assertNotSame('senha-valida-123', $storedPassword);
        $this->assertTrue(Hash::check('senha-valida-123', $storedPassword));
    }

    #[TestDox('create() deve falhar ao gravar um segundo usuário com o mesmo e-mail.')]
    public function test_create_fails_for_a_duplicate_email(): void
    {
        User::factory()->create(['email' => 'repetido@pontoderesgate.local']);

        $this->expectException(UniqueConstraintViolationException::class);

        $this->repository->create([
            'name' => 'Outro Operador',
            'email' => 'repetido@pontoderesgate.local',
            'password' => 'senha-valida-123',
            'role' => UserRole::Operador,
        ]);
    }

    #[TestDox('update() deve devolver a mesma instância recebida, já com os atributos atualizados.')]
    public function test_update_returns_the_same_instance_with_the_new_attributes(): void
    {
        $user = User::factory()->create(['name' => 'Nome Antigo']);

        $updated = $this->repository->update($user, ['name' => 'Nome Novo']);

        $this->assertSame($user, $updated);
        $this->assertSame('Nome Novo', $updated->name);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Nome Novo']);
    }

    #[TestDox('update() deve gravar a nova senha hasheada.')]
    public function test_update_stores_the_new_password_hashed(): void
    {
        $user = User::factory()->create();

        $this->repository->update($user, ['password' => 'nova-senha-456']);

        $storedPassword = $user->fresh()->password;

        $this->assertNotSame('nova-senha-456', $storedPassword);
        $this->assertTrue(Hash::check('nova-senha-456', $storedPassword));
    }

    #[TestDox('update() deve reativar um usuário inativo quando "active" é informado como true.')]
    public function test_update_reactivates_an_inactive_user(): void
    {
        $user = User::factory()->inactive()->create();

        $this->repository->update($user, ['active' => true]);

        $this->assertTrue($user->fresh()->active);
    }

    #[TestDox('revokeTokens() não deve apagar os tokens de outros usuários.')]
    public function test_revoke_tokens_keeps_the_tokens_of_other_users(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $user->createToken('token-do-usuario');
        $otherUser->createToken('token-de-outro');

        $this->repository->revokeTokens($user);

        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(1, $otherUser->tokens()->count());
    }

    #[TestDox('revokeTokens() não deve falhar quando o usuário não tem nenhum token.')]
    public function test_revoke_tokens_does_nothing_when_the_user_has_no_tokens(): void
    {
        $user = User::factory()->create();

        $this->repository->revokeTokens($user);

        $this->assertSame(0, $user->tokens()->count());
    }
}
