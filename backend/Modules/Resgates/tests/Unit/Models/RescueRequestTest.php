<?php

namespace Modules\Resgates\Tests\Unit\Models;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueRequestTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('delete() não deve remover o pedido fisicamente do banco (soft delete).')]
    public function test_delete_soft_deletes_the_rescue_request(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $rescueRequest->delete();

        $this->assertSoftDeleted($rescueRequest);
    }

    #[TestDox('Um pedido soft-deletado não deve aparecer nas consultas padrão.')]
    public function test_soft_deleted_rescue_request_is_excluded_from_default_queries(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $rescueRequest->delete();

        $this->assertNull(RescueRequest::find($rescueRequest->id));
        $this->assertNotNull(RescueRequest::withTrashed()->find($rescueRequest->id));
    }

    #[TestDox('O status lido do banco deve voltar como caso do enum RescueRequestStatus.')]
    public function test_status_is_read_back_as_a_rescue_request_status_enum(): void
    {
        $rescueRequest = RescueRequest::factory()->emResgate()->create();

        $this->assertSame(RescueRequestStatus::EmResgate, $rescueRequest->fresh()->status);
    }

    #[TestDox('Latitude e longitude lidas do banco devem voltar como string com 7 casas decimais.')]
    public function test_coordinates_are_read_back_as_strings_with_seven_decimal_places(): void
    {
        $rescueRequest = RescueRequest::factory()->create([
            'latitude' => -23.5505199,
            'longitude' => -46.6333094,
        ]);

        $fresh = $rescueRequest->fresh();

        $this->assertSame('-23.5505199', $fresh->latitude);
        $this->assertSame('-46.6333094', $fresh->longitude);
    }

    #[TestDox('operator deve devolver o usuário atribuído ao pedido.')]
    public function test_operator_returns_the_assigned_user(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $this->assertTrue($rescueRequest->operator->is($operator));
    }

    #[TestDox('operator deve ser null quando o pedido ainda não tem operador atribuído.')]
    public function test_operator_is_null_when_no_operator_is_assigned(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $this->assertNull($rescueRequest->operator);
    }

    #[TestDox('statusLogs deve devolver somente os logs do próprio pedido.')]
    public function test_status_logs_returns_only_the_logs_of_the_request(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $ownLogs = RescueStatusLog::factory()->count(2)->create(['rescue_request_id' => $rescueRequest->id]);
        RescueStatusLog::factory()->create();

        $this->assertEqualsCanonicalizing($ownLogs->pluck('id')->all(), $rescueRequest->statusLogs->pluck('id')->all());
    }

    #[TestDox('Um pedido soft-deletado deve manter o histórico de logs de auditoria no banco.')]
    public function test_soft_deleting_a_request_keeps_its_audit_logs(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $log = RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id]);

        $rescueRequest->delete();

        $this->assertModelExists($log);
    }

    #[TestDox('Remover fisicamente um pedido (forceDelete) deve remover também os logs de auditoria dele.')]
    public function test_force_deleting_a_request_removes_its_audit_logs(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $log = RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id]);

        $rescueRequest->forceDelete();

        $this->assertModelMissing($log);
    }

    #[TestDox('Remover o operador atribuído deve limpar o operator_id do pedido sem apagar o pedido.')]
    public function test_deleting_the_assigned_operator_clears_the_operator_id_and_keeps_the_request(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $operator->delete();

        $this->assertNull($rescueRequest->fresh()->operator_id);
    }
}
