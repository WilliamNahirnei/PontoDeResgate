<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Resgates\Models\RescueRequest;
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
                'observation',
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

    public function test_log_entries_expose_the_observation_of_a_cancellation_and_of_a_completion(): void
    {
        $adminMaster = User::factory()->adminMaster()->create();
        $operator = User::factory()->create();
        $cancelled = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);
        $completed = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $this->actingAs($operator)->postJson("/api/rescue-requests/{$cancelled->id}/cancel", [
            'cancellation_reason' => 'Endereço não encontrado.',
        ])->assertOk();
        $this->actingAs($operator)->postJson("/api/rescue-requests/{$completed->id}/complete", [
            'completion_note' => 'Família resgatada em segurança.',
        ])->assertOk();

        $logs = collect($this->actingAs($adminMaster)->getJson('/api/rescue-status-logs')->assertOk()->json('data'));

        $this->assertSame(
            'Endereço não encontrado.',
            $logs->firstWhere(fn ($log) => $log['rescue_request']['id'] === $cancelled->id)['observation']
        );
        $this->assertSame(
            'Família resgatada em segurança.',
            $logs->firstWhere(fn ($log) => $log['rescue_request']['id'] === $completed->id)['observation']
        );
    }
}
