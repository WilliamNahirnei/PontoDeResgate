<?php

namespace Modules\Resgates\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Resgates\Models\RescueStatusLog;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;

class RescueStatusLogRepository implements RescueStatusLogRepositoryInterface
{
    /**
     * Persist a new status-change audit log entry.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): RescueStatusLog
    {
        return RescueStatusLog::create($attributes);
    }

    /**
     * Paginate status logs, most recent first, with their rescue request and operator eager-loaded.
     */
    public function paginateWithRelations(int $perPage): LengthAwarePaginator
    {
        return RescueStatusLog::query()
            ->with(['rescueRequest', 'operator'])
            ->latest()
            ->paginate($perPage);
    }
}
