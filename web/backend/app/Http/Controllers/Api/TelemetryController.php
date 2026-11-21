<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Geofence;
use App\Models\Telemetry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelemetryController extends Controller
{
    /** Riwayat terbaru (urut lama → baru) dan data terakhir. */
    public function index(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 60), 1), 500);
        $rows = Telemetry::latest('id')->limit($limit)->get()->reverse()->values();

        return response()->json(['data' => $rows, 'latest' => $rows->last()]);
    }

    public function geofences(): JsonResponse
    {
        return response()->json(['data' => Geofence::all()]);
    }

    public function activities(): JsonResponse
    {
        return response()->json(['data' => ActivityLog::latest('id')->limit(30)->get()]);
    }
}
