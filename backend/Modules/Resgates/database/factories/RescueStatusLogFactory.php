<?php

namespace Modules\Resgates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Usuarios\Models\User;

/**
 * @extends Factory<RescueStatusLog>
 */
class RescueStatusLogFactory extends Factory
{
    protected $model = RescueStatusLog::class;

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
