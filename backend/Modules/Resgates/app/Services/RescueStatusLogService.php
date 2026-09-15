<?php

namespace Modules\Resgates\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;

class RescueStatusLogService
{
    public function __construct(private RescueStatusLogRepositoryInterface $statusLogs) {}

    /**
     * List status-change audit log entries, most recent first, paginated.
     */
    public function list(int $perPage): LengthAwarePaginator
    {
        return $this->statusLogs->paginateWithRelations($perPage);
    }
}
