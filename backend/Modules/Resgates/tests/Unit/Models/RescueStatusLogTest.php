<?php

namespace Modules\Resgates\Tests\Unit\Models;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueStatusLogTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('Os status anterior e novo lidos do banco devem voltar como casos do enum RescueRequestStatus.')]
    public function test_statuses_are_read_back_as_rescue_request_status_enums(): void
    {
        $log = RescueStatusLog::factory()->create([
            'previous_status' => RescueRequestStatus::EmResgate,
            'new_status' => RescueRequestStatus::Cancelado,
        ]);

        $fresh = $log->fresh();

        $this->assertSame(RescueRequestStatus::EmResgate, $fresh->previous_status);
        $this->assertSame(RescueRequestStatus::Cancelado, $fresh->new_status);
    }

    #[TestDox('rescueRequest deve devolver o pedido ao qual o log pertence.')]
    public function test_rescue_request_returns_the_request_the_log_belongs_to(): void
    {
        $rescueRequest = RescueRequest::factory()->create();
        $log = RescueStatusLog::factory()->create(['rescue_request_id' => $rescueRequest->id]);

        $this->assertTrue($log->rescueRequest->is($rescueRequest));
    }

    #[TestDox('operator deve devolver o operador que executou a mudança de status.')]
    public function test_operator_returns_the_user_who_performed_the_change(): void
    {
        $operator = User::factory()->create();
        $log = RescueStatusLog::factory()->create(['operator_id' => $operator->id]);

        $this->assertTrue($log->operator->is($operator));
    }
}
