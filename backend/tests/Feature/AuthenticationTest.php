<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_operator_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create(['password' => 'senha-secreta']);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'senha-secreta',
        ]);

        $response->assertOk();
        $response->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $user = User::factory()->create(['password' => 'senha-secreta']);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'senha-errada',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout');

        $response->assertNoContent();
    }

    public function test_guests_cannot_access_the_panel_endpoints(): void
    {
        $response = $this->getJson('/api/rescue-requests');

        $response->assertUnauthorized();
    }
}
