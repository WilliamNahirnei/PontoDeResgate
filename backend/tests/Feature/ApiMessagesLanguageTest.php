<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Usuarios\Models\User;
use Tests\TestCase;

// REQUISITOS.md §1.1: as mensagens que o sistema devolve são em português,
// mesmo as que a tela não mostra.
class ApiMessagesLanguageTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_returns_a_portuguese_message(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertUnauthorized();
        $response->assertJsonPath('message', 'Não autenticado.');
    }

    public function test_unknown_route_returns_a_portuguese_message(): void
    {
        $response = $this->getJson('/api/nao-existe');

        $response->assertNotFound();
        $response->assertJsonPath('message', 'Recurso não encontrado.');
    }

    public function test_unknown_rescue_request_returns_a_portuguese_message(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->postJson('/api/rescue-requests/999999/assume');

        $response->assertNotFound();
        $response->assertJsonPath('message', 'Recurso não encontrado.');
    }

    public function test_unsupported_method_returns_a_portuguese_message(): void
    {
        $response = $this->deleteJson('/api/login');

        $response->assertMethodNotAllowed();
        $response->assertJsonPath('message', 'Método não permitido.');
    }

    public function test_login_validation_errors_are_in_portuguese(): void
    {
        $response = $this->postJson('/api/login', []);

        $response->assertUnprocessable();
        $response->assertJsonPath('message', 'O campo e-mail é obrigatório. (e mais 1 erro)');
        $response->assertJsonPath('errors.email.0', 'O campo e-mail é obrigatório.');
        $response->assertJsonPath('errors.password.0', 'O campo senha é obrigatório.');
    }

    public function test_public_submission_validation_errors_are_in_portuguese(): void
    {
        $response = $this->postJson('/api/rescue-requests', []);

        $response->assertUnprocessable();
        $response->assertJsonPath('message', 'O campo latitude é obrigatório. (e mais 1 erro)');
        $response->assertJsonPath('errors.latitude.0', 'O campo latitude é obrigatório.');
        $response->assertJsonPath('errors.longitude.0', 'O campo longitude é obrigatório.');
    }
}
