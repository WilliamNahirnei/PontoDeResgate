<?php

namespace Database\Factories;

use App\Enums\RescueRequestStatus;
use App\Models\RescueRequest;
use App\Models\RescueStatusLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RescueStatusLog>
 */
class RescueStatusLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'rescue_request_id' => RescueRequest::factory(),
            'operator_id' => User::factory(),
            'previous_status' => RescueRequestStatus::Pendente,
            'new_status' => RescueRequestStatus::EmResgate,
        ];
    }
}
