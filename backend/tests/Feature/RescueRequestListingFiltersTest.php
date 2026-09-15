<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Models\User;
use Tests\TestCase;

class RescueRequestListingFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_rescue_requests_can_be_filtered_by_status(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(2)->create();
        RescueRequest::factory()->emResgate()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?status=em_resgate');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.status', RescueRequestStatus::EmResgate->value);
    }

    public function test_rescue_requests_can_be_filtered_by_minimum_quantity(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->create(['children_count' => 0]);
        RescueRequest::factory()->create(['children_count' => 3]);
        RescueRequest::factory()->create(['children_count' => null]);

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?min_children_count=1');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.children_count', 3);
    }

    public function test_rescue_requests_can_be_sorted_ascending_by_total_people(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->create(['total_people' => 8]);
        RescueRequest::factory()->create(['total_people' => 2]);
        RescueRequest::factory()->create(['total_people' => 5]);

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?sort_by=total_people&sort_direction=asc');

        $response->assertOk();
        $response->assertJsonPath('data.0.total_people', 2);
        $response->assertJsonPath('data.1.total_people', 5);
        $response->assertJsonPath('data.2.total_people', 8);
    }

    public function test_rescue_requests_without_the_sorted_quantity_are_listed_last(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->create(['total_people' => null]);
        RescueRequest::factory()->create(['total_people' => 4]);

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?sort_by=total_people&sort_direction=asc');

        $response->assertOk();
        $response->assertJsonPath('data.0.total_people', 4);
        $response->assertJsonPath('data.1.total_people', null);
    }

    public function test_rescue_request_listing_rejects_invalid_sort_field(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?sort_by=unknown_field');

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['sort_by']);
    }
}
