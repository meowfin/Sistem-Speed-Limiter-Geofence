<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Geofence;
use App\Models\Telemetry;
use App\Services\MqttService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelemetryController extends Controller
{
    /** Riwayat terbaru pada sesi aktif (urut lama → baru) dan data terakhir. */
    public function index(Request $request, MqttService $mqtt): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 60), 1), 500);
        $activeSession = $mqtt->getActiveTripSession();

        $rows = Telemetry::where('trip_session', $activeSession)
            ->latest('id')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        return response()->json([
            'session' => $activeSession,
            'data'    => $rows,
            'latest'  => $rows->last(),
        ]);
    }

    public function geofences(): JsonResponse
    {
        return response()->json(['data' => Geofence::all()]);
    }

    public function activities(): JsonResponse
    {
        return response()->json(['data' => ActivityLog::latest('id')->limit(30)->get()]);
    }

    public function sessions(): JsonResponse
    {
        $sessions = Telemetry::selectRaw('
                trip_session,
                COUNT(*) as total_records,
                MIN(recorded_at) as started_at,
                MAX(recorded_at) as ended_at,
                ROUND(AVG(rpm), 1) as avg_rpm,
                ROUND(AVG(speed_kmh), 2) as avg_speed_kmh,
                ROUND(AVG(temperature), 1) as avg_temp
            ')
            ->whereNotNull('trip_session')
            ->groupBy('trip_session')
            ->orderByDesc('started_at')
            ->get();

        return response()->json($sessions);
    }

    public function exportCsv(Request $request)
    {
        $session = $request->query('session');
        $query = Telemetry::orderBy('id', 'asc');

        if ($session) {
            $query->where('trip_session', $session);
        }

        $records = $query->get();
        $filename = 'riset-logistik-' . ($session ?: 'semua-sesi') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        $callback = function () use ($records) {
            $file = fopen('php://output', 'w');

            // Header Kolom CSV untuk Excel / Python / Riset
            fputcsv($file, [
                'ID',
                'Timestamp',
                'Trip_Session',
                'Latitude',
                'Longitude',
                'In_Slow_Zone',
                'Arrived',
                'Box_Lock',
                'PID_Mode',
                'Setpoint_RPM',
                'Actual_RPM',
                'PID_Error',
                'PWM_Output',
                'Speed_mps',
                'Speed_kmh',
                'Temperature_C',
                'Humidity_Pct',
            ]);

            foreach ($records as $row) {
                fputcsv($file, [
                    $row->id,
                    $row->recorded_at,
                    $row->trip_session,
                    $row->latitude,
                    $row->longitude,
                    $row->in_zone ? 1 : 0,
                    $row->arrived ? 1 : 0,
                    $row->lock,
                    $row->pid_mode,
                    $row->setpoint_rpm,
                    $row->rpm,
                    $row->pid_error,
                    $row->pwm_out,
                    $row->speed_mps,
                    $row->speed_kmh,
                    $row->temperature,
                    $row->humidity,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}