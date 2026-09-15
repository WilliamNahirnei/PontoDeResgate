<?php

namespace Modules\Resgates\Tests\Unit\Http\Requests\RescueRequest;

use Illuminate\Support\Facades\Validator;
use Modules\Resgates\Http\Requests\RescueRequest\CancelRescueRequestRequest;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class CancelRescueRequestRequestTest extends TestCase
{
    #[TestDox('authorize() deve permitir qualquer requisição — a autorização é feita no middleware da rota.')]
    public function test_authorize_allows_any_request(): void
    {
        $this->assertTrue((new CancelRescueRequestRequest)->authorize());
    }

    #[TestDox('A validação deve exigir o motivo do cancelamento quando ele não é informado.')]
    public function test_cancellation_reason_is_required(): void
    {
        $validator = Validator::make([], (new CancelRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('cancellation_reason', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar um motivo de cancelamento acima de 1000 caracteres.')]
    public function test_cancellation_reason_must_not_exceed_1000_characters(): void
    {
        $validator = Validator::make(
            ['cancellation_reason' => str_repeat('a', 1001)],
            (new CancelRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('cancellation_reason', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve passar quando o motivo do cancelamento é informado corretamente.')]
    public function test_valid_payload_passes_validation(): void
    {
        $validator = Validator::make(
            ['cancellation_reason' => 'Solicitante desistiu do resgate.'],
            (new CancelRescueRequestRequest)->rules()
        );

        $this->assertFalse($validator->fails());
    }
}
