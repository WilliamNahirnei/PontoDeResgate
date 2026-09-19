<?php

namespace Modules\Usuarios\Tests\Unit\Models;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class UserTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('isAdminMaster() deve retornar true para um usuário com papel admin_master.')]
    public function test_is_admin_master_returns_true_for_an_admin_master_user(): void
    {
        $user = User::factory()->adminMaster()->make();

        $this->assertTrue($user->isAdminMaster());
    }

    #[TestDox('isAdminMaster() deve retornar false para um usuário com papel operador.')]
    public function test_is_admin_master_returns_false_for_an_operator_user(): void
    {
        $user = User::factory()->make();

        $this->assertFalse($user->isAdminMaster());
    }

    #[TestDox('isOperador() deve retornar true para um usuário com papel operador.')]
    public function test_is_operador_returns_true_for_an_operator_user(): void
    {
        $user = User::factory()->make();

        $this->assertTrue($user->isOperador());
    }

    #[TestDox('isOperador() deve retornar false para um usuário com papel admin_master.')]
    public function test_is_operador_returns_false_for_an_admin_master_user(): void
    {
        $user = User::factory()->adminMaster()->make();

        $this->assertFalse($user->isOperador());
    }

    #[TestDox('A senha atribuída em texto puro deve ser armazenada hasheada (cast "hashed").')]
    public function test_password_is_hashed_when_assigned_in_plain_text(): void
    {
        $user = User::factory()->make(['password' => 'senha-valida-123']);

        $this->assertNotSame('senha-valida-123', $user->password);
        $this->assertTrue(Hash::check('senha-valida-123', $user->password));
    }

    #[TestDox('Uma senha que já é um hash não deve ser hasheada de novo ao ser atribuída.')]
    public function test_password_that_is_already_hashed_is_not_hashed_again(): void
    {
        $hash = Hash::make('senha-valida-123');

        $user = User::factory()->make(['password' => $hash]);

        $this->assertSame($hash, $user->password);
    }

    #[TestDox('O papel lido do banco deve voltar como caso do enum UserRole.')]
    public function test_role_is_read_back_as_a_user_role_enum(): void
    {
        $user = User::factory()->adminMaster()->create();

        $this->assertSame(UserRole::AdminMaster, $user->fresh()->role);
    }

    #[TestDox('O campo active lido do banco deve voltar como booleano.')]
    public function test_active_is_read_back_as_a_boolean(): void
    {
        $active = User::factory()->create();
        $inactive = User::factory()->inactive()->create();

        $this->assertTrue($active->fresh()->active);
        $this->assertFalse($inactive->fresh()->active);
    }

    #[TestDox('A serialização do usuário não deve expor password nem remember_token.')]
    public function test_serialization_hides_the_password_and_the_remember_token(): void
    {
        $user = User::factory()->create();

        $serialized = $user->fresh()->toArray();

        $this->assertArrayNotHasKey('password', $serialized);
        $this->assertArrayNotHasKey('remember_token', $serialized);
    }

    #[TestDox('rescueRequestsAsOperator() deve devolver somente os pedidos atribuídos ao próprio usuário.')]
    public function test_rescue_requests_as_operator_returns_only_the_users_own_requests(): void
    {
        $operator = User::factory()->create();
        $otherOperator = User::factory()->create();
        $ownRequests = RescueRequest::factory()->count(2)->emResgate()->create(['operator_id' => $operator->id]);
        RescueRequest::factory()->emResgate()->create(['operator_id' => $otherOperator->id]);
        RescueRequest::factory()->create();

        $result = $operator->rescueRequestsAsOperator;

        $this->assertEqualsCanonicalizing($ownRequests->pluck('id')->all(), $result->pluck('id')->all());
    }

    #[TestDox('rescueRequestsAsOperator() deve devolver uma coleção vazia quando o usuário não assumiu nenhum pedido.')]
    public function test_rescue_requests_as_operator_is_empty_when_the_user_has_no_requests(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->create();

        $this->assertCount(0, $operator->rescueRequestsAsOperator);
    }
}
