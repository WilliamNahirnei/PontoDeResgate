<?php

namespace Modules\Resgates\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Resgates\Models\RescueStatusLog;

interface RescueStatusLogRepositoryInterface
{
    /**
     * Persist a new status-change audit log entry.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): RescueStatusLog;

    /**
     * Paginate status logs, most recent first, with their rescue request and operator eager-loaded.
     */
    public function paginateWithRelations(int $perPage): LengthAwarePaginator;
}
