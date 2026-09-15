<?php

namespace Modules\Usuarios\Tests\Unit\Models;

use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class UserTest extends TestCase
{
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
}
