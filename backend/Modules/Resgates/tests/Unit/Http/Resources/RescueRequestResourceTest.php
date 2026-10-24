<?php

namespace Modules\Resgates\Tests\Unit\Http\Resources;

use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Http\Resources\RescueRequestResource;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueRequestResourceTest extends TestCase
{
    #[TestDox('A resposta deve expor exatamente os campos públicos do pedido, com latitude/longitude numéricas e status como string.')]
    public function test_it_exposes_exactly_the_public_fields_of_the_request(): void
    {
        $rescueRequest = RescueRequest::factory()->make([
            'id' => 10,
            'latitude' => -23.5505199,
            'longitude' => -46.6333094,
            'requester_name' => 'Ana Beatriz',
            'total_people' => 5,
            'men_count' => 1,
            'women_count' => 2,
            'children_count' => 1,
            'elderly_count' => 1,
            'animals_count' => 0,
            'reference_point' => 'Casa azul, próximo à ponte.',
            'status' => RescueRequestStatus::Cancelado,
            'cancellation_reason' => 'Solicitante desistiu.',
            'created_at' => '2026-09-19 10:00:00',
            'updated_at' => '2026-09-19 11:30:00',
        ]);

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertSame([
            'id' => 10,
            'latitude' => -23.5505199,
            'longitude' => -46.6333094,
            'requester_name' => 'Ana Beatriz',
            'total_people' => 5,
            'men_count' => 1,
            'women_count' => 2,
            'children_count' => 1,
            'elderly_count' => 1,
            'animals_count' => 0,
            'reference_point' => 'Casa azul, próximo à ponte.',
            'status' => 'cancelado',
            'cancellation_reason' => 'Solicitante desistiu.',
            'completion_note' => null,
            'created_at' => '2026-09-19T10:00:00.000000Z',
            'updated_at' => '2026-09-19T11:30:00.000000Z',
        ], $data);
    }

    #[TestDox('A resposta deve expor como null os campos opcionais que não foram informados no pedido.')]
    public function test_it_exposes_null_for_the_optional_fields_that_were_not_provided(): void
    {
        $rescueRequest = RescueRequest::factory()->make([
            'requester_name' => null,
            'total_people' => null,
            'men_count' => null,
            'women_count' => null,
            'children_count' => null,
            'elderly_count' => null,
            'animals_count' => null,
            'reference_point' => null,
            'cancellation_reason' => null,
            'completion_note' => null,
        ]);

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertNull($data['requester_name']);
        $this->assertNull($data['total_people']);
        $this->assertNull($data['men_count']);
        $this->assertNull($data['women_count']);
        $this->assertNull($data['children_count']);
        $this->assertNull($data['elderly_count']);
        $this->assertNull($data['animals_count']);
        $this->assertNull($data['reference_point']);
        $this->assertNull($data['cancellation_reason']);
        $this->assertNull($data['completion_note']);
    }

    #[TestDox('A resposta não deve incluir a chave "operator" quando a relação não foi carregada.')]
    public function test_it_omits_the_operator_key_when_the_relation_is_not_loaded(): void
    {
        $rescueRequest = RescueRequest::factory()->make();

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertArrayNotHasKey('operator', $data);
    }

    #[TestDox('A resposta deve expor "operator" como null quando a relação foi carregada e o pedido não tem operador.')]
    public function test_it_exposes_a_null_operator_when_the_relation_is_loaded_without_an_operator(): void
    {
        $rescueRequest = RescueRequest::factory()->make();
        $rescueRequest->setRelation('operator', null);

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertArrayHasKey('operator', $data);
        $this->assertNull($data['operator']);
    }

    #[TestDox('A resposta deve expor "operator" com os campos públicos do usuário quando a relação foi carregada com um operador.')]
    public function test_it_exposes_the_operator_as_a_user_resource_when_the_relation_is_loaded(): void
    {
        $operator = User::factory()->make([
            'id' => 3,
            'name' => 'Carlos Operador',
            'email' => 'carlos@pontoderesgate.local',
        ]);
        $rescueRequest = RescueRequest::factory()->emResgate()->make();
        $rescueRequest->setRelation('operator', $operator);

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertSame([
            'id' => 3,
            'name' => 'Carlos Operador',
            'email' => 'carlos@pontoderesgate.local',
            'role' => 'operador',
            'active' => true,
        ], $data['operator']);
    }

    #[TestDox('A resposta deve expor a observação da conclusão do pedido concluído.')]
    public function test_it_exposes_the_completion_note(): void
    {
        $rescueRequest = RescueRequest::factory()->make([
            'status' => RescueRequestStatus::Concluido,
            'completion_note' => 'Família resgatada em segurança.',
        ]);

        $data = (new RescueRequestResource($rescueRequest))->response()->getData(true)['data'];

        $this->assertSame('Família resgatada em segurança.', $data['completion_note']);
    }
}
