<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Usuarios\Models\User;
use Tests\TestCase;

class RescueStatusLogListingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_master_can_list_rescue_status_logs(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        RescueStatusLog::factory()->count(3)->create();

        $response = $this->actingAs($adminMaster)->getJson('/api/rescue-status-logs');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonStructure([
            'data' => [[
                'id',
                'rescue_request' => ['id', 'requester_name', 'reference_point'],
                'operator' => ['id', 'name', 'email', 'role', 'active'],
                'previous_status',
                'new_status',
                'created_at',
            ]],
            'meta' => ['current_page', 'last_page', 'total'],
        ]);
    }

    public function test_rescue_status_log_list_is_paginated(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        RescueStatusLog::factory()->count(20)->create();

        $response = $this->actingAs($adminMaster)->getJson('/api/rescue-status-logs?per_page=15');

        $response->assertOk();
        $response->assertJsonCount(15, 'data');
        $response->assertJsonPath('meta.total', 20);
    }

    public function test_regular_operator_cannot_list_rescue_status_logs(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-status-logs');

        $response->assertForbidden();
    }

    public function test_guests_cannot_list_rescue_status_logs(): void
    {
        $response = $this->getJson('/api/rescue-status-logs');

        $response->assertUnauthorized();
    }
}
