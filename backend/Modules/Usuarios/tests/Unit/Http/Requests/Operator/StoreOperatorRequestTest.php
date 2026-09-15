<?php

namespace Modules\Usuarios\Tests\Unit\Http\Requests\Operator;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Modules\Usuarios\Http\Requests\Operator\StoreOperatorRequest;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class StoreOperatorRequestTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('authorize() deve permitir um usuário admin_master.')]
    public function test_authorize_allows_an_admin_master_user(): void
    {
        $request = new StoreOperatorRequest;
        $request->setUserResolver(fn () => User::factory()->adminMaster()->make());

        $this->assertTrue($request->authorize());
    }

    #[TestDox('authorize() deve negar um usuário operador comum.')]
    public function test_authorize_denies_a_non_admin_master_user(): void
    {
        $request = new StoreOperatorRequest;
        $request->setUserResolver(fn () => User::factory()->make());

        $this->assertFalse($request->authorize());
    }

    #[TestDox('authorize() deve negar quando não há usuário autenticado.')]
    public function test_authorize_denies_a_guest(): void
    {
        $request = new StoreOperatorRequest;
        $request->setUserResolver(fn () => null);

        $this->assertFalse($request->authorize());
    }

    #[TestDox('A validação deve exigir nome quando e-mail e senha são informados.')]
    public function test_name_is_required(): void
    {
        $validator = Validator::make([
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('name', $errors);
        $this->assertArrayNotHasKey('email', $errors);
        $this->assertArrayNotHasKey('password', $errors);
    }

    #[TestDox('A validação deve exigir e-mail quando nome e senha são informados.')]
    public function test_email_is_required(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'password' => 'senha-valida-123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('email', $errors);
        $this->assertArrayNotHasKey('name', $errors);
        $this->assertArrayNotHasKey('password', $errors);
    }

    #[TestDox('A validação deve exigir senha quando nome e e-mail são informados.')]
    public function test_password_is_required(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
        ], (new StoreOperatorRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('password', $errors);
        $this->assertArrayNotHasKey('name', $errors);
        $this->assertArrayNotHasKey('email', $errors);
    }

    #[TestDox('A validação deve rejeitar um e-mail já usado por outro usuário.')]
    public function test_email_must_be_unique(): void
    {
        $existing = User::factory()->create();

        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => $existing->email,
            'password' => 'senha-valida',
        ], (new StoreOperatorRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('email', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar um e-mail ainda não usado por nenhum usuário.')]
    public function test_email_accepts_a_unique_email(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertArrayNotHasKey('email', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar uma senha menor que o mínimo exigido.')]
    public function test_password_must_meet_the_default_password_rules(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => '123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('password', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar uma senha que atende às regras padrão de senha.')]
    public function test_password_accepts_a_password_meeting_the_default_rules(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertArrayNotHasKey('password', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve passar quando todos os campos são informados corretamente.')]
    public function test_valid_payload_passes_validation(): void
    {
        $validator = Validator::make([
            'name' => 'Novo Operador',
            'email' => 'novo.operador@pontoderesgate.local',
            'password' => 'senha-valida-123',
        ], (new StoreOperatorRequest)->rules());

        $this->assertFalse($validator->fails());
    }
}
