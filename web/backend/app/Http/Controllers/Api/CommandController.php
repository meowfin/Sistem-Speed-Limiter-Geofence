<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\MqttService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

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
            'action' => 'COMMAND_'.$command,
            'message' => "Perintah {$command} dikirim dari dashboard",
        ]);

        return response()->json(['status' => 'sent', 'command' => $command]);
    }
}
