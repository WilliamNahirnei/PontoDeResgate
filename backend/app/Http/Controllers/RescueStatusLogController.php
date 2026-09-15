<?php

namespace App\Http\Controllers;

use App\Http\Resources\RescueStatusLogResource;
use App\Models\RescueStatusLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
