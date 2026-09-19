<?php

namespace Modules\Usuarios\Tests\Unit\Services;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Modules\Usuarios\Models\User;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;
use Modules\Usuarios\Services\AuthService;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class AuthServiceTest extends TestCase
{
    use LazilyRefreshDatabase, MockeryPHPUnitIntegration;

    #[TestDox('login() deve devolver o usuário e um token válido quando e-mail e senha conferem.')]
    public function test_login_returns_the_user_and_a_valid_token_for_correct_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'operador@pontoderesgate.local',
            'password' => 'senha-correta-123',
        ]);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')
            ->once()
            ->with('operador@pontoderesgate.local')
            ->andReturn($user);

        $service = new AuthService($users);

        $result = $service->login('operador@pontoderesgate.local', 'senha-correta-123');

        $this->assertTrue($result['user']->is($user));
        $this->assertTrue(PersonalAccessToken::findToken($result['token'])->tokenable->is($user));
    }

    #[TestDox('login() deve gravar exatamente um token chamado "painel-operador" para o usuário autenticado.')]
    public function test_login_persists_a_single_token_named_painel_operador(): void
    {
        $user = User::factory()->create(['password' => 'senha-correta-123']);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')->once()->andReturn($user);

        $service = new AuthService($users);

        $service->login($user->email, 'senha-correta-123');

        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
            'name' => 'painel-operador',
        ]);
    }

    #[TestDox('login() deve rejeitar um e-mail que não pertence a nenhum usuário, sem criar token.')]
    public function test_login_rejects_an_unknown_email_without_issuing_a_token(): void
    {
        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')
            ->once()
            ->with('nao-existe@pontoderesgate.local')
            ->andReturn(null);

        $service = new AuthService($users);

        try {
            $service->login('nao-existe@pontoderesgate.local', 'qualquer-senha');
            $this->fail('Esperava que login() lançasse uma ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertSame(['email' => ['As credenciais informadas não conferem.']], $exception->errors());
        }

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[TestDox('login() deve rejeitar uma senha incorreta com a mesma mensagem do e-mail inexistente, sem criar token.')]
    public function test_login_rejects_a_wrong_password_without_issuing_a_token(): void
    {
        $user = User::factory()->create(['password' => 'senha-correta-123']);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')->once()->andReturn($user);

        $service = new AuthService($users);

        try {
            $service->login($user->email, 'senha-errada-456');
            $this->fail('Esperava que login() lançasse uma ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertSame(['email' => ['As credenciais informadas não conferem.']], $exception->errors());
        }

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[TestDox('login() deve rejeitar um usuário desativado que informou a senha correta, sem criar token.')]
    public function test_login_rejects_a_deactivated_user_with_the_correct_password(): void
    {
        $user = User::factory()->inactive()->create(['password' => 'senha-correta-123']);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')->once()->andReturn($user);

        $service = new AuthService($users);

        try {
            $service->login($user->email, 'senha-correta-123');
            $this->fail('Esperava que login() lançasse uma ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertSame(['email' => ['Este usuário foi desativado.']], $exception->errors());
        }

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[TestDox('login() não deve revelar que o usuário está desativado quando a senha informada está incorreta.')]
    public function test_login_does_not_reveal_a_deactivated_user_when_the_password_is_wrong(): void
    {
        $user = User::factory()->inactive()->create(['password' => 'senha-correta-123']);

        $users = \Mockery::mock(UserRepositoryInterface::class);
        $users->shouldReceive('findByEmail')->once()->andReturn($user);

        $service = new AuthService($users);

        try {
            $service->login($user->email, 'senha-errada-456');
            $this->fail('Esperava que login() lançasse uma ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertSame(['email' => ['As credenciais informadas não conferem.']], $exception->errors());
        }
    }

    #[TestDox('logout() deve apagar o token usado na requisição atual e preservar os demais tokens do usuário.')]
    public function test_logout_deletes_only_the_current_access_token(): void
    {
        $user = User::factory()->create();
        $currentToken = $user->createToken('token-atual');
        $otherToken = $user->createToken('outro-dispositivo');
        $user->withAccessToken($currentToken->accessToken);

        $service = new AuthService(\Mockery::mock(UserRepositoryInterface::class));

        $service->logout($user);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $currentToken->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $otherToken->accessToken->id]);
    }
}
