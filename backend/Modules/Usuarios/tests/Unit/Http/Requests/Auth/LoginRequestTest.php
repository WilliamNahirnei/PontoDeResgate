<?php

namespace Modules\Usuarios\Tests\Unit\Http\Requests\Auth;

use Illuminate\Support\Facades\Validator;
use Modules\Usuarios\Http\Requests\Auth\LoginRequest;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class LoginRequestTest extends TestCase
{
    #[TestDox('authorize() deve permitir qualquer requisição, autenticada ou não.')]
    public function test_authorize_allows_any_request(): void
    {
        $this->assertTrue((new LoginRequest)->authorize());
    }

    #[TestDox('A validação deve exigir e-mail quando somente a senha é informada.')]
    public function test_email_is_required(): void
    {
        $validator = Validator::make([
            'password' => 'senha-secreta',
        ], (new LoginRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('email', $errors);
        $this->assertArrayNotHasKey('password', $errors);
    }

    #[TestDox('A validação deve exigir senha quando somente o e-mail é informado.')]
    public function test_password_is_required(): void
    {
        $validator = Validator::make([
            'email' => 'operador@pontoderesgate.local',
        ], (new LoginRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('password', $errors);
        $this->assertArrayNotHasKey('email', $errors);
    }

    #[TestDox('A validação deve rejeitar um e-mail com formato inválido.')]
    public function test_email_must_be_a_valid_email_address(): void
    {
        $validator = Validator::make([
            'email' => 'nao-e-um-email',
            'password' => 'qualquer-senha',
        ], (new LoginRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('email', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar um e-mail com formato válido.')]
    public function test_email_accepts_a_valid_email_address(): void
    {
        $validator = Validator::make([
            'email' => 'operador@pontoderesgate.local',
            'password' => 'senha-secreta',
        ], (new LoginRequest)->rules());

        $this->assertArrayNotHasKey('email', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve passar quando e-mail e senha são informados corretamente.')]
    public function test_valid_payload_passes_validation(): void
    {
        $validator = Validator::make([
            'email' => 'operador@pontoderesgate.local',
            'password' => 'senha-secreta',
        ], (new LoginRequest)->rules());

        $this->assertFalse($validator->fails());
    }
}
