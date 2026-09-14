<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperatorManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_master_can_register_a_new_operator(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();

        $response = $this->actingAs($adminMaster)->postJson('/api/operators', [
            'name' => 'Novo Operador',
            'email' => 'operador@example.com',
            'password' => 'senha-forte-123',
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('users', [
            'email' => 'operador@example.com',
            'role' => UserRole::Operador->value,
        ]);
    }

    public function test_regular_operator_cannot_register_new_operators(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->postJson('/api/operators', [
            'name' => 'Novo Operador',
            'email' => 'operador2@example.com',
            'password' => 'senha-forte-123',
        ]);

        $response->assertForbidden();
    }

    public function test_guests_cannot_register_operators(): void
    {
        $response = $this->postJson('/api/operators', [
            'name' => 'Novo Operador',
            'email' => 'operador3@example.com',
            'password' => 'senha-forte-123',
        ]);

        $response->assertUnauthorized();
    }
}
