<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\OperatorController;
use App\Http\Controllers\RescueRequestController;
use App\Http\Controllers\RescueStatusLogController;
use Illuminate\Support\Facades\Route;

// Tela pública: qualquer pessoa pode registrar um pedido de socorro, sem autenticação.
Route::post('/rescue-requests', [RescueRequestController::class, 'store']);

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/rescue-requests', [RescueRequestController::class, 'index']);
    Route::post('/rescue-requests/{rescueRequest}/assume', [RescueRequestController::class, 'assume']);
    Route::post('/rescue-requests/{rescueRequest}/complete', [RescueRequestController::class, 'complete']);
    Route::post('/rescue-requests/{rescueRequest}/cancel', [RescueRequestController::class, 'cancel']);

    Route::middleware('role:admin_master')->group(function () {
        Route::get('/operators', [OperatorController::class, 'index']);
        Route::post('/operators', [OperatorController::class, 'store']);
        Route::post('/operators/{operator}/deactivate', [OperatorController::class, 'deactivate']);
        Route::post('/operators/{operator}/activate', [OperatorController::class, 'activate']);

        Route::get('/rescue-status-logs', [RescueStatusLogController::class, 'index']);
    });
});
