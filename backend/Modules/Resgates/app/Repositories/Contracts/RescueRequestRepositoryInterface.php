<?php

namespace Modules\Resgates\Repositories\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Modules\Resgates\Models\RescueRequest;

interface RescueRequestRepositoryInterface
{
    /**
     * Persist a new rescue request with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): RescueRequest;

    /**
     * List rescue requests matching the given filters, sorted by the given column/direction.
     *
     * Requests missing the sorted column are always listed last, regardless of direction.
     *
     * @param  array<string, mixed>  $filters  Accepts "status" and the "min_<column>" quantity filters.
     * @return Collection<int, RescueRequest>
     */
    public function listWithFilters(array $filters, string $sortBy, string $sortDirection): Collection;

    /**
     * Update a rescue request's attributes (typically its status and related fields).
     *
     * @param  array<string, mixed>  $attributes
     */
    public function updateStatus(RescueRequest $rescueRequest, array $attributes): RescueRequest;

    /**
     * Reload the rescue request from the database with its operator relation eager-loaded.
     */
    public function freshWithOperator(RescueRequest $rescueRequest): RescueRequest;
}
