<?php

use App\Http\Controllers\Api\CommandController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\TelemetryController;
use Illuminate\Support\Facades\Route;

// Telemetri, Geofence, & Riwayat Riset CSV
Route::get('/telemetries', [TelemetryController::class, 'index']);
Route::get('/telemetries/sessions', [TelemetryController::class, 'sessions']);
Route::get('/telemetries/export-csv', [TelemetryController::class, 'exportCsv']);
Route::get('/geofences', [TelemetryController::class, 'geofences']);
Route::get('/activities', [TelemetryController::class, 'activities']);

// Perintah Kendali Servo, Reset Sesi, & Tuning PID
Route::post('/command/lock', [CommandController::class, 'lock']);
Route::post('/command/unlock', [CommandController::class, 'unlock']);
Route::post('/command/reset', [CommandController::class, 'reset']);
Route::post('/command/pid', [CommandController::class, 'setPid']);
Route::post('/command/pid-mode', [CommandController::class, 'setPidMode']);

// Manajemen SCM QR Code (Generate & Scan HP)
Route::get('/packages', [PackageController::class, 'index']);
Route::post('/packages', [PackageController::class, 'store']);
Route::post('/packages/verify-scan', [PackageController::class, 'verifyScan']);
Route::delete('/packages/{package}', [PackageController::class, 'destroy']);