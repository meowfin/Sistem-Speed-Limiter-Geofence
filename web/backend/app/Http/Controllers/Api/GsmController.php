<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MqttService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GsmController extends Controller
{
    /** Jalur cadangan HTTP (SIM800L): format JSON sama dengan payload MQTT. */
    public function receive(Request $request, MqttService $mqtt): JsonResponse
    {
        $request->validate(['lat' => 'required|numeric', 'lng' => 'required|numeric']);

        $row = $mqtt->ingest($request->all(), 'gsm');

        return response()->json(['status' => 'ok', 'id' => $row?->id], 201);
    }
}
