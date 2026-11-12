<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::get('/telemetries', [\App\Http\Controllers\Api\TelemetryController::class, 'index']);
Route::post('/command/lock', [\App\Http\Controllers\Api\CommandController::class, 'lock']);
Route::post('/command/unlock', [\App\Http\Controllers\Api\CommandController::class, 'unlock']);
Route::post('/gsm', [\App\Http\Controllers\Api\GsmController::class, 'receive']);