<?php

use Illuminate\Support\Facades\Route;
use Modules\Resgates\Http\Controllers\RescueRequestController;
use Modules\Resgates\Http\Controllers\RescueStatusLogController;

// Tela pública: qualquer pessoa pode registrar um pedido de socorro, sem autenticação.
Route::post('/rescue-requests', [RescueRequestController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/rescue-requests', [RescueRequestController::class, 'index']);
    Route::post('/rescue-requests/{rescueRequest}/assume', [RescueRequestController::class, 'assume']);
    Route::post('/rescue-requests/{rescueRequest}/complete', [RescueRequestController::class, 'complete']);
    Route::post('/rescue-requests/{rescueRequest}/cancel', [RescueRequestController::class, 'cancel']);

    Route::middleware('role:admin_master')->group(function () {
        Route::get('/rescue-status-logs', [RescueStatusLogController::class, 'index']);
    });
});
