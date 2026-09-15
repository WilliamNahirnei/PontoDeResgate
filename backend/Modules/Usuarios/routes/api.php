<?php

use Illuminate\Support\Facades\Route;
use Modules\Usuarios\Http\Controllers\Auth\AuthController;
use Modules\Usuarios\Http\Controllers\OperatorController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware('role:admin_master')->group(function () {
        Route::get('/operators', [OperatorController::class, 'index']);
        Route::post('/operators', [OperatorController::class, 'store']);
        Route::post('/operators/{operator}/deactivate', [OperatorController::class, 'deactivate']);
        Route::post('/operators/{operator}/activate', [OperatorController::class, 'activate']);
    });
});
