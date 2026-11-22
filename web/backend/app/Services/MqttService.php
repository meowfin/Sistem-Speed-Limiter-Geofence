<?php

namespace App\Services;

use App\Events\TelemetryUpdated;
use App\Models\ActivityLog;
use App\Models\Telemetry;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use PhpMqtt\Client\Facades\MQTT;
use Illuminate\Support\Carbon;

class MqttService
{
    // Diameter roda standar smart car 6.5 cm = 0.065 meter
    private const WHEEL_DIAMETER_M = 0.065;

    public function __construct(
        protected GeofenceService $geofenceService
    ) {}

    /**
     * Ambil atau buat kode sesi perjalanan aktif saat ini
     */
    public function getActiveTripSession(): string
    {
        return Cache::rememberForever('active_trip_session', function () {
            return 'TRIP-' . Carbon::now()->format('Ymd-His');
        });
    }

    public function resetTripSession(): string
    {
        $newSession = 'TRIP-' . Carbon::now()->format('Ymd-His');
        Cache::forever('active_trip_session', $newSession);

        // Kirim perintah RESET ke ESP32 agar prevArrived di-reset & box dikunci kembali
        $this->publishCommand('RESET');

        ActivityLog::create([
            'vehicle_id' => config('mqtt.vehicle_id'),
            'action'     => 'TRIP_RESET',
            'message'    => 'Sesi perjalanan di-reset, memulai sesi baru: ' . $newSession,
        ]);

        return $newSession;
    }

    /**
     * Kirim perintah teks (LOCK, UNLOCK, RESET, SET_SPEED:xxx, dll) ke ESP32
     */
    public function publishCommand(string $command): void
    {
        MQTT::publish(
            config('mqtt.topics.command'),
            $command,
            false,
            'publisher'
        );
    }

    /**
     * Kirim konfigurasi parameter PID (Kp, Ki, Kd) ke ESP32
     */
    public function publishPidConfig(float $kp, float $ki, float $kd): void
    {
        $cmd = sprintf('SET_PID:%.3f,%.3f,%.3f', $kp, $ki, $kd);
        $this->publishCommand($cmd);
    }

    /**
     * Ubah mode kendali motor ESP32 (AUTO = Closed-Loop PID, MANUAL = Open-Loop PWM)
     */
    public function publishPidMode(string $mode): void
    {
        $normalized = strtoupper($mode) === 'MANUAL' ? 'MANUAL' : 'AUTO';
        $this->publishCommand('PID_MODE:' . $normalized);
    }

    /**
     * Kirim target Setpoint RPM langsung ke ESP32
     */
    public function publishSetpointRpm(float $rpm): void
    {
        $cmd = sprintf('SET_RPM:%.1f', $rpm);
        $this->publishCommand($cmd);
    }

    public function syncZonesToEsp(): void
    {
        $zones = \App\Models\Geofence::all();
        $payload = [];

        foreach ($zones as $zone) {
            if ($zone->type === 'polyline' && is_array($zone->path_points)) {
                foreach ($zone->path_points as $pt) {
                    $payload[] = [
                        'category' => $zone->zone_category,
                        'lat'      => (float) $pt['lat'],
                        'lng'      => (float) $pt['lng'],
                        'radius'   => (float) $zone->radius_meters,
                    ];
                }
            } elseif ($zone->center_lat !== null && $zone->center_lng !== null) {
                $payload[] = [
                    'category' => $zone->zone_category,
                    'lat'      => (float) $zone->center_lat,
                    'lng'      => (float) $zone->center_lng,
                    'radius'   => (float) $zone->radius_meters,
                ];
            }
        }

        MQTT::publish(
            'unsoed/wokwi/esp32gpsTK24/zones',
            json_encode($payload),
            true,
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

        $lat = (float) $payload['lat'];
        $lng = (float) $payload['lng'];
        $hasValidGps = ($lat !== 0.0 || $lng !== 0.0);

        $d = $payload;
        $via = $via === 'gsm' ? 'gsm' : 'wifi';
        $vehicleId = config('mqtt.vehicle_id');
        $activeSession = $this->getActiveTripSession();

        // Ambil data terakhir PADA SESI AKTIF SAAT INI
        $prev = Telemetry::where('vehicle_id', $vehicleId)
            ->where('trip_session', $activeSession)
            ->latest('id')
            ->first();

        // Fallback ke koordinat terakhir lintas sesi jika sesi baru baru saja dimulai saat indoor
        $lastKnownLocation = $prev ?? Telemetry::where('vehicle_id', $vehicleId)->latest('id')->first();

        $effectiveLat = $hasValidGps ? $lat : ($lastKnownLocation?->latitude ?? -7.429413);
        $effectiveLng = $hasValidGps ? $lng : ($lastKnownLocation?->longitude ?? 109.335385);

        $inZone   = (bool) ($d['in_zone'] ?? false);
        $arrived  = (bool) ($d['arrived'] ?? false);
        $distance = $d['dist'] ?? ($prev?->distance ?? 0);

        // 1 & 2. EVALUASI ZONA & KIRIM PERINTAH HANYA JIKA GPS SUDAH LOCK SATELIT
        if ($hasValidGps) {
            $geo = $this->geofenceService->evaluatePosition($lat, $lng);
            $inZone   = $geo['in_zone'];
            $arrived  = $geo['arrived'];
            $distance = $d['dist'] ?? $geo['distance'];

            if ($arrived) {
                $this->publishCommand('SET_SPEED:180');
                if (! $prev || ! $prev->arrived) {
                    $this->publishCommand('UNLOCK');
                }
            } elseif ($inZone) {
                $this->publishCommand('SET_SPEED:120');
                if ($prev && $prev->arrived) {
                    $this->publishCommand('LOCK');
                }
            } else {
                $this->publishCommand('SET_SPEED:180');
                if ($prev && $prev->arrived) {
                    $this->publishCommand('LOCK');
                }
            }
        }

        // 3. HITUNG KECEPATAN LINEAR DARI RPM (RODA DIAMETER 6.5 CM)
        $rpm = isset($d['rpm']) ? (float) $d['rpm'] : 0.0;
        $wheelCircumference = M_PI * self::WHEEL_DIAMETER_M;
        $speedMps = round(($rpm * $wheelCircumference) / 60.0, 3);
        $speedKmh = round($speedMps * 3.6, 2);

        $actualLock = isset($d['lock'])
            ? strtoupper((string) $d['lock'])
            : ($arrived ? 'UNLOCKED' : 'LOCKED');

        // 4. SIMPAN DATA KE DATABASE LENGKAP DENGAN DATA PID & KECEPATAN
        $t = Telemetry::create([
            'vehicle_id'   => $vehicleId,
            'trip_session' => $activeSession,
            'latitude'     => $effectiveLat,
            'longitude'    => $effectiveLng,
            'speed'        => $speedKmh,
            'speed_mps'    => $speedMps,
            'speed_kmh'    => $speedKmh,
            'rpm'          => (int) round($rpm),
            'setpoint_rpm' => isset($d['setpoint_rpm']) ? (float) $d['setpoint_rpm'] : null,
            'pid_error'    => isset($d['pid_error']) ? (float) $d['pid_error'] : null,
            'pwm_out'      => isset($d['pwm_out']) ? (int) $d['pwm_out'] : null,
            'pid_mode'     => isset($d['pid_mode']) ? strtoupper((string) $d['pid_mode']) : 'AUTO',
            'temperature'  => $d['temp'] ?? null,
            'humidity'     => $d['hum'] ?? null,
            'battery'      => $d['batt'] ?? null,
            'lock'         => $actualLock,
            'arrived'      => $arrived,
            'in_zone'      => $inZone,
            'distance'     => $distance,
            $via           => 'online',
            'recorded_at'  => now(),
        ]);

        // 5. LOGGING & BROADCAST KE DASHBOARD (Sertakan Kp, Ki, Kd & rpm presisi desimal)
        $this->logChanges($prev, $t);

        $broadcastPayload = array_merge($t->toArray(), [
            'rpm_exact' => round($rpm, 1),
            'kp'        => $d['kp'] ?? null,
            'ki'        => $d['ki'] ?? null,
            'kd'        => $d['kd'] ?? null,
        ]);

        event(new TelemetryUpdated($broadcastPayload));

        return $t;
    }

    private function logChanges(?Telemetry $p, Telemetry $t): void
    {
        $log = fn(string $action, string $msg) => ActivityLog::create([
            'vehicle_id' => $t->vehicle_id,
            'action'     => $action,
            'message'    => $msg,
        ]);

        if (! $p) {
            $log('FIRST_DATA', 'Data telemetri pertama sesi ' . $t->trip_session . ' diterima');
            return;
        }

        if ($p->in_zone !== $t->in_zone) {
            $log(
                $t->in_zone ? 'ENTER_ZONE' : 'EXIT_ZONE',
                $t->in_zone ? 'Masuk zona lambat (kecepatan diturunkan)' : 'Keluar dari zona lambat'
            );
        }

        if (! $p->arrived && $t->arrived) {
            $log('ARRIVED', 'Kendaraan tiba di tujuan, box dibuka');
        }

        if ($t->lock && $p->lock !== $t->lock) {
            $log('LOCK_' . $t->lock, 'Status box kargo: ' . $t->lock);
        }
    }
}
