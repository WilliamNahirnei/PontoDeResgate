<?php

namespace Modules\Usuarios\Tests\Unit\Http\Resources;

use Modules\Usuarios\Http\Resources\UserResource;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class UserResourceTest extends TestCase
{
    #[TestDox('toArray() deve expor exatamente id, nome, e-mail, papel e status de um operador ativo.')]
    public function test_it_exposes_exactly_the_public_fields_of_an_active_operator(): void
    {
        $user = User::factory()->make([
            'id' => 7,
            'name' => 'Ana Lima',
            'email' => 'ana.lima@pontoderesgate.local',
        ]);

        $resolved = (new UserResource($user))->resolve();

        $this->assertSame([
            'id' => 7,
            'name' => 'Ana Lima',
            'email' => 'ana.lima@pontoderesgate.local',
            'role' => 'operador',
            'active' => true,
        ], $resolved);
    }

    #[TestDox('toArray() deve expor o papel admin_master como string.')]
    public function test_it_exposes_the_admin_master_role_as_a_string(): void
    {
        $user = User::factory()->adminMaster()->make();

        $resolved = (new UserResource($user))->resolve();

        $this->assertSame('admin_master', $resolved['role']);
    }

    #[TestDox('toArray() deve expor active como false para um usuário desativado.')]
    public function test_it_exposes_active_as_false_for_a_deactivated_user(): void
    {
        $user = User::factory()->inactive()->make();

        $resolved = (new UserResource($user))->resolve();

        $this->assertFalse($resolved['active']);
    }
}
