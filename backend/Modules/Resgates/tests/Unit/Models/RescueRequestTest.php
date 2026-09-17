<?php

namespace Modules\Resgates\Tests\Unit\Models;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Models\RescueRequest;
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
}
