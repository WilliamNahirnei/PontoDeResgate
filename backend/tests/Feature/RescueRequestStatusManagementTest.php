<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Models\User;
use Tests\TestCase;

class RescueRequestStatusManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_operator_can_assume_a_pending_rescue_request(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/assume");

        $response->assertOk();
        $response->assertJsonPath('data.status', RescueRequestStatus::EmResgate->value);
        $response->assertJsonPath('data.operator.id', $operator->id);

        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::EmResgate->value,
            'operator_id' => $operator->id,
        ]);

        $this->assertDatabaseHas('rescue_status_logs', [
            'rescue_request_id' => $rescueRequest->id,
            'operator_id' => $operator->id,
            'previous_status' => RescueRequestStatus::Pendente->value,
            'new_status' => RescueRequestStatus::EmResgate->value,
        ]);
    }

    public function test_cannot_assume_a_rescue_request_that_is_not_pending(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create();

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/assume");

        $response->assertStatus(409);
    }

    public function test_operator_can_complete_a_rescue_request_in_progress(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete");

        $response->assertOk();
        $response->assertJsonPath('data.status', RescueRequestStatus::Concluido->value);

        $this->assertDatabaseHas('rescue_status_logs', [
            'rescue_request_id' => $rescueRequest->id,
            'previous_status' => RescueRequestStatus::EmResgate->value,
            'new_status' => RescueRequestStatus::Concluido->value,
        ]);
    }

    public function test_cannot_complete_a_pending_rescue_request(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete");

        $response->assertStatus(409);
    }

    public function test_operator_can_cancel_a_rescue_request_with_a_reason(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/cancel", [
            'cancellation_reason' => 'Endereço não encontrado após duas tentativas.',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.status', RescueRequestStatus::Cancelado->value);
        $response->assertJsonPath('data.cancellation_reason', 'Endereço não encontrado após duas tentativas.');
    }

    public function test_cancellation_reason_is_required(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/cancel");

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['cancellation_reason']);
    }

    public function test_operators_can_list_rescue_requests(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(3)->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    public function test_operator_can_complete_a_rescue_request_with_a_note(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete", [
            'completion_note' => 'Família resgatada em segurança.',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.status', RescueRequestStatus::Concluido->value);
        $response->assertJsonPath('data.completion_note', 'Família resgatada em segurança.');
    }

    public function test_completion_note_is_optional(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete");

        $response->assertOk();
        $response->assertJsonPath('data.completion_note', null);
    }

    public function test_a_blank_completion_note_is_treated_as_not_informed(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete", [
            'completion_note' => '   ',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.completion_note', null);
    }

    public function test_completion_note_accepts_exactly_1000_characters(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete", [
            'completion_note' => str_repeat('a', 1000),
        ]);

        $response->assertOk();
        $this->assertSame(1000, strlen($response->json('data.completion_note')));
    }

    public function test_completion_note_over_1000_characters_is_rejected_and_the_request_stays_in_progress(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);

        $response = $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete", [
            'completion_note' => str_repeat('a', 1001),
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['completion_note']);
        $this->assertDatabaseHas('rescue_requests', [
            'id' => $rescueRequest->id,
            'status' => RescueRequestStatus::EmResgate->value,
        ]);
        $this->assertDatabaseCount('rescue_status_logs', 0);
    }

    public function test_a_failed_completion_does_not_record_the_note(): void
    {
        $operator = User::factory()->create();
        $rescueRequest = RescueRequest::factory()->create();

        $this->actingAs($operator)->postJson("/api/rescue-requests/{$rescueRequest->id}/complete", [
            'completion_note' => 'Não deveria gravar.',
        ])->assertStatus(409);

        $this->assertDatabaseHas('rescue_requests', ['id' => $rescueRequest->id, 'completion_note' => null]);
    }
}
