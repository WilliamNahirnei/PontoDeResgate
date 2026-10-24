<?php

namespace Modules\Resgates\Tests\Unit\Http\Requests\RescueRequest;

use Illuminate\Support\Facades\Validator;
use Modules\Resgates\Http\Requests\RescueRequest\CompleteRescueRequestRequest;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class CompleteRescueRequestRequestTest extends TestCase
{
    #[TestDox('authorize() deve permitir qualquer requisição — a autorização é feita no middleware da rota.')]
    public function test_authorize_allows_any_request(): void
    {
        $this->assertTrue((new CompleteRescueRequestRequest)->authorize());
    }

    #[TestDox('A validação deve passar sem observação — ela é opcional.')]
    public function test_completion_note_is_optional(): void
    {
        $validator = Validator::make([], (new CompleteRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve aceitar a observação nula.')]
    public function test_completion_note_accepts_null(): void
    {
        $validator = Validator::make(['completion_note' => null], (new CompleteRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve aceitar uma observação com exatamente 1000 caracteres.')]
    public function test_completion_note_accepts_exactly_1000_characters(): void
    {
        $validator = Validator::make(
            ['completion_note' => str_repeat('a', 1000)],
            (new CompleteRescueRequestRequest)->rules()
        );

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve rejeitar uma observação acima de 1000 caracteres.')]
    public function test_completion_note_must_not_exceed_1000_characters(): void
    {
        $validator = Validator::make(
            ['completion_note' => str_repeat('a', 1001)],
            (new CompleteRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('completion_note', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar uma observação que não seja texto.')]
    public function test_completion_note_must_be_a_string(): void
    {
        $validator = Validator::make(
            ['completion_note' => ['a', 'b']],
            (new CompleteRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('completion_note', $validator->errors()->toArray());
    }
}
