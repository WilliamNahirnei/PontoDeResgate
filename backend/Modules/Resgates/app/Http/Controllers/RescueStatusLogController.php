<?php

namespace Modules\Resgates\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Resgates\Http\Resources\RescueStatusLogResource;
use Modules\Resgates\Services\RescueStatusLogService;

class RescueStatusLogController extends Controller
{
    public function __construct(private RescueStatusLogService $service) {}

    /**
     * List status-change audit log entries, paginated (admin master only).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $logs = $this->service->list($request->integer('per_page', 15));

        return RescueStatusLogResource::collection($logs);
    }
}
