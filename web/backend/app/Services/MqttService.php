<?php

namespace App\Services;

use App\Events\TelemetryUpdated;
use App\Models\ActivityLog;
use App\Models\Telemetry;
use App\Models\Geofence; // Tambahkan model Geofence
use Illuminate\Support\Facades\Log;
use PhpMqtt\Client\Facades\MQTT;

class MqttService
{
    /**
     * Kirim perintah teks (LOCK, UNLOCK, atau SET_SPEED:xxx) ke ESP32
     */
    public function publishCommand(string $command): void
    {
        MQTT::publish(
            config('mqtt.topics.command'),
            strtoupper($command),
            false,
            'publisher'
        );
    }

    /**
     * Proses data sensor dari MQTT atau HTTP
     */
    public function ingest(string|array $payload, string $via = 'wifi'): ?Telemetry
    {
        if (is_string($payload)) {
            $payload = json_decode(
                preg_replace('/\bnan\b/i', 'null', $payload),
                true
            );
        }

        if (
            ! is_array($payload) ||
            ! is_numeric($payload['lat'] ?? null) ||
            ! is_numeric($payload['lng'] ?? null)
        ) {
            Log::warning('Payload telemetri tidak valid', ['payload' => $payload]);
            return null;
        }

        $d = $payload;
        $via = $via === 'gsm' ? 'gsm' : 'wifi';
        $vehicleId = config('mqtt.vehicle_id');

        // 1. HITUNG GEOFENCE DI LARAVEL (CLOUD-SIDE LOGIC)
        $lat = $d['lat'];
        $lng = $d['lng'];
        $inZone = false;
        $arrived = false;

        // Ambil semua zona dari database
        $zones = Geofence::all();
        foreach ($zones as $zone) {
            $distance = $this->haversine($lat, $lng, $zone->center_lat, $zone->center_lng);
            
            // Jika masuk radius zona
            if ($distance <= $zone->radius_meters) {
                if ($zone->name == 'Zona Lambat (Zona Sekolah)') {
                    $inZone = true;
                } elseif ($zone->name == 'Tujuan (Zona Unlock)') {
                    $arrived = true;
                }
            }
        }

        // 2. KIRIM PERINTAH BALIK KE ESP32 BERDASARKAN ZONA
        if ($arrived) {
            $this->publishCommand('UNLOCK');
            $this->publishCommand('SET_SPEED:0'); // Berhenti
        } elseif ($inZone) {
            $this->publishCommand('SET_SPEED:100'); // Lambat
            $this->publishCommand('LOCK');
        } else {
            $this->publishCommand('SET_SPEED:255'); // Cepat
            $this->publishCommand('LOCK');
        }

        // 3. SIMPAN DATA KE DATABASE
        $prev = Telemetry::where('vehicle_id', $vehicleId)->latest('id')->first();

        $t = Telemetry::create([
            'vehicle_id' => $vehicleId,
            'latitude' => $lat,
            'longitude' => $lng,
            'rpm' => isset($d['rpm']) ? (int) round($d['rpm']) : null,
            'temperature' => $d['temp'] ?? null,
            'humidity' => $d['hum'] ?? null,
            'battery' => $d['batt'] ?? null,
            // Gunakan hasil hitungan Laravel, bukan dari ESP32
            'lock' => $arrived ? 'UNLOCKED' : 'LOCKED', 
            'arrived' => $arrived,
            'in_zone' => $inZone,
            'distance' => $d['dist'] ?? null,
            $via => 'online',
            'recorded_at' => now(),
        ]);

        // 4. LOGGING & BROADCAST KE DASHBOARD
        $this->logChanges($prev, $t);
        event(new TelemetryUpdated($t->toArray()));

        return $t;
    }

    /**
     * Mencatat perubahan status kendaraan ke activity_logs.
     */
    private function logChanges(?Telemetry $p, Telemetry $t): void
    {
        $log = fn (string $action, string $msg) => ActivityLog::create([
            'vehicle_id' => $t->vehicle_id,
            'action' => $action,
            'message' => $msg,
        ]);

        if (! $p) {
            $log('FIRST_DATA', 'Data telemetri pertama diterima');
            return;
        }

        if ($p->in_zone !== $t->in_zone) {
            $log(
                $t->in_zone ? 'ENTER_ZONE' : 'EXIT_ZONE',
                $t->in_zone ? 'Masuk zona lambat (PWM diturunkan)' : 'Keluar dari zona lambat'
            );
        }

        if (! $p->arrived && $t->arrived) {
            $log('ARRIVED', 'Kendaraan tiba di tujuan, box dibuka');
        }

        if ($t->lock && $p->lock !== $t->lock) {
            $log('LOCK_' . $t->lock, 'Status box kargo: ' . $t->lock);
        }
    }

    /**
     * Rumus Haversine untuk menghitung jarak (meter)
     */
    private function haversine($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371000; // meter
        $latFrom = deg2rad($lat1);
        $lonFrom = deg2rad($lon1);
        $latTo = deg2rad($lat2);
        $lonTo = deg2rad($lon2);
        $latDelta = $latTo - $latFrom;
        $lonDelta = $lonTo - $lonFrom;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
          cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));

        return $angle * $earthRadius;
    }
}