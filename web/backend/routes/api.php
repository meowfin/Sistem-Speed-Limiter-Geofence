<?php

use App\Http\Controllers\Api\CommandController;
use App\Http\Controllers\Api\GsmController;
use App\Http\Controllers\Api\TelemetryController;
use Illuminate\Support\Facades\Route;

Route::get('/telemetries', [TelemetryController::class, 'index']);
Route::get('/geofences', [TelemetryController::class, 'geofences']);
Route::get('/activities', [TelemetryController::class, 'activities']);
Route::post('/command/lock', [CommandController::class, 'lock']);
Route::post('/command/unlock', [CommandController::class, 'unlock']);
Route::post('/gsm', [GsmController::class, 'receive']);
