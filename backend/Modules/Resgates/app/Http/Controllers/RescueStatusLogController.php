<?php

namespace Modules\Resgates\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Resgates\Http\Resources\RescueStatusLogResource;
use Modules\Resgates\Models\RescueStatusLog;

class RescueStatusLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $logs = RescueStatusLog::query()
            ->with(['rescueRequest', 'operator'])
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return RescueStatusLogResource::collection($logs);
    }
}
