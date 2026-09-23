<?php

namespace Modules\Resgates\Tests\Unit\Http\Resources;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Http\Resources\RescueStatusLogResource;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueStatusLogResourceTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('A resposta deve expor exatamente o log, um resumo do pedido, o operador e os status como string.')]
    public function test_it_exposes_exactly_the_public_fields_of_the_log(): void
    {
        $rescueRequest = RescueRequest::factory()->create([
            'requester_name' => 'Ana Beatriz',
            'reference_point' => 'Casa azul, próximo à ponte.',
        ]);
        $operator = User::factory()->create([
            'name' => 'Carlos Operador',
            'email' => 'carlos@pontoderesgate.local',
        ]);
        $log = RescueStatusLog::factory()->create([
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => RescueRequestStatus::Pendente,
            'new_status' => RescueRequestStatus::EmResgate,
            'created_at' => '2026-09-19 10:00:00',
        ]);

        $data = (new RescueStatusLogResource($log->load(['rescueRequest', 'operator'])))->response()->getData(true)['data'];

        $this->assertSame([
            'id' => $log->id,
            'rescue_request' => [
                'id' => $rescueRequest->id,
                'requester_name' => 'Ana Beatriz',
                'reference_point' => 'Casa azul, próximo à ponte.',
            ],
            'operator' => [
                'id' => $operator->id,
                'name' => 'Carlos Operador',
                'email' => 'carlos@pontoderesgate.local',
                'role' => 'operador',
                'active' => true,
            ],
            'previous_status' => 'pendente',
            'new_status' => 'em_resgate',
            'created_at' => '2026-09-19T10:00:00.000000Z',
        ], $data);
    }

    #[TestDox('A resposta deve expor como null o nome e o ponto de referência quando o pedido não os informou.')]
    public function test_it_exposes_null_for_the_request_summary_fields_that_were_not_provided(): void
    {
        $rescueRequest = RescueRequest::factory()->create([
            'requester_name' => null,
            'reference_point' => null,
        ]);
        $log = RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id]);

        $data = (new RescueStatusLogResource($log->load(['rescueRequest', 'operator'])))->response()->getData(true)['data'];

        $this->assertNull($data['rescue_request']['requester_name']);
        $this->assertNull($data['rescue_request']['reference_point']);
    }

    #[TestDox('A resposta deve continuar expondo os dados do pedido mesmo quando ele foi excluído (soft delete).')]
    public function test_it_exposes_the_request_summary_even_when_the_request_is_soft_deleted(): void
    {
        $rescueRequest = RescueRequest::factory()->create([
            'requester_name' => 'Ana Beatriz',
            'reference_point' => 'Casa azul, próximo à ponte.',
        ]);
        $log = RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id]);
        $rescueRequest->delete();

        $data = (new RescueStatusLogResource($log->fresh()->load(['rescueRequest', 'operator'])))->response()->getData(true)['data'];

        $this->assertSame([
            'id' => $rescueRequest->id,
            'requester_name' => 'Ana Beatriz',
            'reference_point' => 'Casa azul, próximo à ponte.',
        ], $data['rescue_request']);
    }
}
