<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Usuarios\Enums\UserRole;
use Modules\Usuarios\Models\User;
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

    public function test_admin_master_can_list_operators(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        User::factory()->count(3)->create();

        $response = $this->actingAs($adminMaster)->getJson('/api/operators');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonStructure([
            'data' => [['id', 'name', 'email', 'role', 'active']],
            'meta' => ['current_page', 'last_page', 'total'],
        ]);
    }

    public function test_operator_list_is_paginated(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        User::factory()->count(20)->create();

        $response = $this->actingAs($adminMaster)->getJson('/api/operators?per_page=15');

        $response->assertOk();
        $response->assertJsonCount(15, 'data');
        $response->assertJsonPath('meta.total', 20);
    }

    public function test_operator_list_can_be_filtered_by_name(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        User::factory()->create(['name' => 'Maria Souza']);
        User::factory()->create(['name' => 'João Pereira']);

        $response = $this->actingAs($adminMaster)->getJson('/api/operators?name=Maria');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.name', 'Maria Souza');
    }

    public function test_operator_list_can_be_filtered_by_email(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        User::factory()->create(['email' => 'maria@example.com']);
        User::factory()->create(['email' => 'joao@example.com']);

        $response = $this->actingAs($adminMaster)->getJson('/api/operators?email=joao@');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.email', 'joao@example.com');
    }

    public function test_regular_operator_cannot_list_operators(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->getJson('/api/operators');

        $response->assertForbidden();
    }

    public function test_guests_cannot_list_operators(): void
    {
        $response = $this->getJson('/api/operators');

        $response->assertUnauthorized();
    }

    public function test_admin_master_can_deactivate_an_operator(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        $operator = User::factory()->create();

        $response = $this->actingAs($adminMaster)->postJson("/api/operators/{$operator->id}/deactivate");

        $response->assertOk();
        $response->assertJsonPath('data.active', false);
        $this->assertDatabaseHas('users', ['id' => $operator->id, 'active' => false]);
    }

    public function test_admin_master_can_reactivate_a_deactivated_operator(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        $operator = User::factory()->inactive()->create();

        $response = $this->actingAs($adminMaster)->postJson("/api/operators/{$operator->id}/activate");

        $response->assertOk();
        $response->assertJsonPath('data.active', true);
        $this->assertDatabaseHas('users', ['id' => $operator->id, 'active' => true]);
    }

    public function test_deactivating_an_operator_revokes_their_tokens(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        $operator = User::factory()->create();
        $operator->createToken('painel-operador');

        $this->actingAs($adminMaster)->postJson("/api/operators/{$operator->id}/deactivate");

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_regular_operator_cannot_deactivate_other_operators(): void
    {
        $operator = User::factory()->create();
        $otherOperator = User::factory()->create();

        $response = $this->actingAs($operator)->postJson("/api/operators/{$otherOperator->id}/deactivate");

        $response->assertForbidden();
    }
}
