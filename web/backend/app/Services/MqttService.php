<?php

namespace App\Services;

use App\Events\TelemetryUpdated;
use App\Models\ActivityLog;
use App\Models\Telemetry;
use Illuminate\Support\Facades\Log;
use PhpMqtt\Client\Facades\MQTT;

class MqttService
{
    /**
     * Kirim perintah teks "LOCK" / "UNLOCK" ke ESP32
     * melalui topik command.
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
     * Proses data sensor dari MQTT (via wifi)
     * atau HTTP POST /api/gsm (via gsm).
     *
     * Data disimpan ke database, perubahan status dicatat,
     * lalu dikirim melalui Reverb.
     */
    public function ingest(string|array $payload, string $via = 'wifi'): ?Telemetry
    {
        if (is_string($payload)) {
            // Mengubah nilai nan menjadi null jika sensor DHT22 gagal membaca.
            $payload = json_decode(
                preg_replace('/\bnan\b/i', 'null', $payload),
                true
            );
        }

        // Memastikan payload valid dan koordinat GPS tersedia.
        if (
            ! is_array($payload) ||
            ! is_numeric($payload['lat'] ?? null) ||
            ! is_numeric($payload['lng'] ?? null)
        ) {
            Log::warning('Payload telemetri tidak valid', [
                'payload' => $payload,
            ]);

            return null;
        }

        $d = $payload;

        // Menentukan sumber koneksi perangkat.
        $via = $via === 'gsm' ? 'gsm' : 'wifi';

        $vehicleId = config('mqtt.vehicle_id');

        // Mengambil data telemetri sebelumnya.
        $prev = Telemetry::where('vehicle_id', $vehicleId)
            ->latest('id')
            ->first();

        // Menyimpan data sensor ke database.
        $t = Telemetry::create([
            'vehicle_id' => $vehicleId,
            'latitude' => $d['lat'],
            'longitude' => $d['lng'],
            'rpm' => isset($d['rpm'])
                ? (int) round($d['rpm'])
                : null,
            'temperature' => $d['temp'] ?? null,
            'humidity' => $d['hum'] ?? null,
            'battery' => $d['batt'] ?? null,
            'lock' => in_array(
                $d['lock'] ?? null,
                ['LOCKED', 'UNLOCKED'],
                true
            ) ? $d['lock'] : null,
            'arrived' => (bool) ($d['arrived'] ?? false),
            'in_zone' => (bool) ($d['inZone'] ?? false),
            'distance' => $d['dist'] ?? null,
            $via => 'online',
            'recorded_at' => now(),
        ]);

        // Mencatat perubahan status kendaraan.
        $this->logChanges($prev, $t);

        // Mengirim data terbaru ke dashboard melalui Reverb.
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

        // Jika ini data pertama yang diterima.
        if (! $p) {
            $log(
                'FIRST_DATA',
                'Data telemetri pertama diterima'
            );

            return;
        }

        // Jika kendaraan masuk atau keluar zona lambat.
        if ($p->in_zone !== $t->in_zone) {
            $log(
                $t->in_zone ? 'ENTER_ZONE' : 'EXIT_ZONE',
                $t->in_zone
                    ? 'Masuk zona lambat (target RPM diturunkan)'
                    : 'Keluar dari zona lambat'
            );
        }

        // Jika kendaraan sudah tiba di tujuan.
        if (! $p->arrived && $t->arrived) {
            $log(
                'ARRIVED',
                'Kendaraan tiba di tujuan, unlock diizinkan'
            );
        }

        // Jika status kunci berubah.
        if ($t->lock && $p->lock !== $t->lock) {
            $log(
                'LOCK_' . $t->lock,
                'Status box kargo: ' . $t->lock
            );
        }
    }
}
