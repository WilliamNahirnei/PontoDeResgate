<?php

namespace Modules\Resgates\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Resgates\Models\RescueRequest;

/**
 * @extends Factory<RescueRequest>
 */
class RescueRequestFactory extends Factory
{
    protected $model = RescueRequest::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'latitude' => fake()->latitude(-33, 5),
            'longitude' => fake()->longitude(-73, -34),
            'requester_name' => fake()->name(),
            'total_people' => fake()->numberBetween(1, 10),
            'men_count' => fake()->numberBetween(0, 5),
            'women_count' => fake()->numberBetween(0, 5),
            'children_count' => fake()->numberBetween(0, 5),
            'elderly_count' => fake()->numberBetween(0, 5),
            'animals_count' => fake()->numberBetween(0, 3),
            'reference_point' => fake()->streetAddress(),
            'status' => RescueRequestStatus::Pendente,
        ];
    }

    /**
     * Indicate that the request is currently being rescued by the given operator.
     */
    public function emResgate(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RescueRequestStatus::EmResgate,
        ]);
    }
}
