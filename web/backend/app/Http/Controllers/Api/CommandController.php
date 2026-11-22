<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\MqttService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;

class CommandController extends Controller
{
    public function lock(MqttService $mqtt): JsonResponse
    {
        return $this->send($mqtt, 'LOCK');
    }

    public function unlock(MqttService $mqtt): JsonResponse
    {
        return $this->send($mqtt, 'UNLOCK');
    }

    private function send(MqttService $mqtt, string $command): JsonResponse
    {
        try {
            $mqtt->publishCommand($command);
        } catch (\Throwable $e) {
            Log::error('Gagal publish perintah MQTT', ['command' => $command, 'error' => $e->getMessage()]);

            return response()->json(['status' => 'error', 'message' => 'Gagal mengirim perintah ke broker MQTT.'], 502);
        }

        ActivityLog::create([
            'vehicle_id' => config('mqtt.vehicle_id'),
            'action' => 'COMMAND_' . $command,
            'message' => "Perintah {$command} dikirim dari dashboard",
        ]);

        return response()->json(['status' => 'sent', 'command' => $command]);
    }

    public function reset(MqttService $mqtt)
    {
        $newSession = $mqtt->resetTripSession();
        event(new \App\Events\TripReset($newSession));

        return response()->json([
            'status'      => 'ok',
            'message'     => 'Perjalanan berhasil di-reset dan kontainer dikunci kembali.',
            'new_session' => $newSession,
        ]);
    }

    public function setPid(Request $request, MqttService $mqtt)
    {
        $data = $request->validate([
            'kp'           => 'required|numeric|min:0|max:50',
            'ki'           => 'required|numeric|min:0|max:50',
            'kd'           => 'required|numeric|min:0|max:50',
            'setpoint_rpm' => 'nullable|numeric|min:0|max:250',
        ]);

        $mqtt->publishPidConfig((float) $data['kp'], (float) $data['ki'], (float) $data['kd']);

        if (isset($data['setpoint_rpm'])) {
            $mqtt->publishSetpointRpm((float) $data['setpoint_rpm']);
        }

        return response()->json([
            'status'  => 'ok',
            'message' => 'Parameter PID berhasil dikirim ke ESP32',
        ]);
    }

    public function setPidMode(Request $request, MqttService $mqtt)
    {
        $data = $request->validate([
            'mode' => 'required|in:AUTO,MANUAL,auto,manual',
        ]);

        $mqtt->publishPidMode($data['mode']);

        return response()->json([
            'status'  => 'ok',
            'message' => 'Mode kendali diubah ke ' . strtoupper($data['mode']),
        ]);
    }
}
