<?php

namespace Tests\Feature;

use App\Enums\RescueRequestStatus;
use App\Models\RescueRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RescueRequestPublicSubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_anyone_can_submit_a_rescue_request_without_authentication(): void
    {
        $response = $this->postJson('/api/rescue-requests', [
            'latitude' => -23.5505,
            'longitude' => -46.6333,
            'requester_name' => 'Maria Silva',
            'total_people' => 4,
            'men_count' => 1,
            'women_count' => 1,
            'children_count' => 2,
            'animals_count' => 1,
            'reference_point' => 'Perto do mercado azul',
        ]);

        $response->assertCreated();

        $this->assertDatabaseCount('rescue_requests', 1);

        $rescueRequest = RescueRequest::first();
        $this->assertSame(RescueRequestStatus::Pendente, $rescueRequest->status);
        $this->assertSame('Maria Silva', $rescueRequest->requester_name);
    }

    public function test_only_the_location_is_required(): void
    {
        $response = $this->postJson('/api/rescue-requests', [
            'latitude' => -23.5505,
            'longitude' => -46.6333,
        ]);

        $response->assertCreated();
        $this->assertDatabaseCount('rescue_requests', 1);
    }

    public function test_latitude_and_longitude_are_required(): void
    {
        $response = $this->postJson('/api/rescue-requests', []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['latitude', 'longitude']);
    }
}
