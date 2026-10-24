<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
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

    public function test_rescue_request_listing_is_paginated_with_50_items_by_default(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(55)->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests');

        $response->assertOk();
        $response->assertJsonCount(50, 'data');
        $response->assertJsonPath('meta.per_page', 50);
        $response->assertJsonPath('meta.current_page', 1);
        $response->assertJsonPath('meta.total', 55);
        $response->assertJsonPath('meta.last_page', 2);
    }

    public function test_rescue_request_listing_second_page_returns_the_remaining_items(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(55)->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?page=2');

        $response->assertOk();
        $response->assertJsonCount(5, 'data');
        $response->assertJsonPath('meta.current_page', 2);
        $response->assertJsonPath('meta.from', 51);
        $response->assertJsonPath('meta.to', 55);
    }

    /**
     * @return array<string, array{0: int}>
     */
    public static function allowedPerPage(): array
    {
        return ['5' => [5], '10' => [10], '20' => [20], '30' => [30], '50' => [50], '100' => [100]];
    }

    #[DataProvider('allowedPerPage')]
    public function test_rescue_request_listing_honors_each_allowed_per_page(int $perPage): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(105)->create();

        $response = $this->actingAs($operator)->getJson("/api/rescue-requests?per_page={$perPage}");

        $response->assertOk();
        $response->assertJsonCount($perPage, 'data');
        $response->assertJsonPath('meta.per_page', $perPage);
        $response->assertJsonPath('meta.total', 105);
    }

    public function test_rescue_request_listing_rejects_a_per_page_outside_the_allowed_list(): void
    {
        $operator = User::factory()->create();

        $this->actingAs($operator)->getJson('/api/rescue-requests?per_page=15')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
        $this->actingAs($operator)->getJson('/api/rescue-requests?per_page=1000')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
    }

    public function test_rescue_request_listing_rejects_an_invalid_page(): void
    {
        $operator = User::factory()->create();

        $this->actingAs($operator)->getJson('/api/rescue-requests?page=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('page');
    }

    public function test_rescue_request_listing_total_counts_only_filtered_items(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(7)->create();
        RescueRequest::factory()->count(3)->emResgate()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?status=em_resgate&per_page=5');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonPath('meta.total', 3);
        $response->assertJsonPath('meta.last_page', 1);
    }

    public function test_rescue_request_listing_page_beyond_the_last_is_empty(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(3)->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?page=9&per_page=5');

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
        $response->assertJsonPath('meta.total', 3);
    }

    public function test_rescue_request_listing_keeps_unfilled_quantities_at_the_end_of_the_last_page(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->count(3)->create(['total_people' => null]);
        foreach (range(1, 5) as $quantity) {
            RescueRequest::factory()->create(['total_people' => $quantity]);
        }

        $response = $this->actingAs($operator)
            ->getJson('/api/rescue-requests?sort_by=total_people&sort_direction=desc&per_page=5&page=2');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $response->assertJsonPath('data.0.total_people', null);
        $response->assertJsonPath('data.2.total_people', null);
    }

    public function test_mine_filter_lists_only_requests_whose_responsible_is_the_authenticated_user(): void
    {
        $operator = User::factory()->create();
        $other = User::factory()->create();
        RescueRequest::factory()->create();
        $inProgress = RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);
        $concluded = RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido, 'operator_id' => $operator->id]);
        $cancelled = RescueRequest::factory()->create(['status' => RescueRequestStatus::Cancelado, 'operator_id' => $operator->id]);
        RescueRequest::factory()->emResgate()->create(['operator_id' => $other->id]);

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?mine=1');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
        $this->assertEqualsCanonicalizing(
            [$inProgress->id, $concluded->id, $cancelled->id],
            collect($response->json('data'))->pluck('id')->all()
        );
        $response->assertJsonPath('meta.total', 3);
    }

    public function test_listing_without_the_mine_filter_lists_requests_of_every_operator(): void
    {
        $operator = User::factory()->create();
        $other = User::factory()->create();
        RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);
        RescueRequest::factory()->emResgate()->create(['operator_id' => $other->id]);
        RescueRequest::factory()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?mine=0');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    public function test_mine_filter_combines_with_the_status_filter(): void
    {
        $operator = User::factory()->create();
        RescueRequest::factory()->emResgate()->create(['operator_id' => $operator->id]);
        RescueRequest::factory()->create(['status' => RescueRequestStatus::Concluido, 'operator_id' => $operator->id]);
        RescueRequest::factory()->emResgate()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?mine=1&status=em_resgate');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.status', RescueRequestStatus::EmResgate->value);
        $response->assertJsonPath('data.0.operator.id', $operator->id);
    }

    public function test_mine_filter_rejects_a_value_that_is_not_boolean(): void
    {
        $operator = User::factory()->create();

        $response = $this->actingAs($operator)->getJson('/api/rescue-requests?mine=talvez');

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['mine']);
    }

    public function test_rescue_request_listing_requires_authentication(): void
    {
        $this->getJson('/api/rescue-requests?per_page=10')->assertUnauthorized();
    }
}
