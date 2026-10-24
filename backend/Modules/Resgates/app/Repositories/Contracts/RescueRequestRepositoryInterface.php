<?php

namespace Modules\Resgates\Repositories\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
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
     * Paginate rescue requests matching the given filters, sorted by the given column/direction.
     *
     * Requests missing the sorted column are always listed last (of the whole list, not of
     * each page), regardless of direction. The page is read from the current request.
     *
     * @param  array<string, mixed>  $filters  Accepts "status" and the "min_<column>" quantity filters.
     * @return LengthAwarePaginator<int, RescueRequest>
     */
    public function paginateWithFilters(array $filters, string $sortBy, string $sortDirection, int $perPage): LengthAwarePaginator;

    /**
     * Reload the rescue request from the database, locking its row until the current
     * transaction ends, so concurrent status changes on it run one at a time.
     */
    public function findForUpdate(RescueRequest $rescueRequest): RescueRequest;

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
