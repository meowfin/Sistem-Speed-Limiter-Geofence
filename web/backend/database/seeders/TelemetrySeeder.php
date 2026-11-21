<?php

namespace Database\Seeders;

use App\Models\Telemetry;
use Illuminate\Database\Seeder;

class TelemetrySeeder extends Seeder
{
    public function run(): void
    {
        // Hapus data simulasi sebelumnya agar tidak menumpuk
        Telemetry::where('vehicle_id', 'TRUCK-01')->delete();

        // Data simulasi perjalanan kendaraan
        $data = [
            [
                'latitude' => -7.425000,
                'longitude' => 109.229000,
                'speed' => 10.5,
                'rpm' => 750,
                'temperature' => 28.5,
                'humidity' => 65,
                'battery' => 95,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 5,
            ],
            [
                'latitude' => -7.424995,
                'longitude' => 109.229020,
                'speed' => 15.2,
                'rpm' => 850,
                'temperature' => 28.7,
                'humidity' => 64,
                'battery' => 94,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 7,
            ],
            [
                'latitude' => -7.424990,
                'longitude' => 109.229050,
                'speed' => 18.4,
                'rpm' => 950,
                'temperature' => 29.0,
                'humidity' => 63,
                'battery' => 94,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 10,
            ],
            [
                'latitude' => -7.424970,
                'longitude' => 109.229080,
                'speed' => 20.1,
                'rpm' => 1050,
                'temperature' => 29.2,
                'humidity' => 62,
                'battery' => 93,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 15,
            ],
            [
                'latitude' => -7.424950,
                'longitude' => 109.229120,
                'speed' => 16.8,
                'rpm' => 900,
                'temperature' => 29.4,
                'humidity' => 61,
                'battery' => 93,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 20,
            ],
            [
                'latitude' => -7.424930,
                'longitude' => 109.229160,
                'speed' => 12.5,
                'rpm' => 800,
                'temperature' => 29.1,
                'humidity' => 62,
                'battery' => 92,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => true,
                'distance' => 25,
            ],
            [
                'latitude' => -7.424910,
                'longitude' => 109.229220,
                'speed' => 8.5,
                'rpm' => 700,
                'temperature' => 28.9,
                'humidity' => 63,
                'battery' => 92,
                'lock' => 'LOCKED',
                'arrived' => false,
                'in_zone' => false,
                'distance' => 35,
            ],
            [
                'latitude' => -7.424883,
                'longitude' => 109.229367,
                'speed' => 0,
                'rpm' => 0,
                'temperature' => 28.5,
                'humidity' => 65,
                'battery' => 91,
                'lock' => 'UNLOCKED',
                'arrived' => true,
                'in_zone' => true,
                'distance' => 0,
            ],
        ];

        foreach ($data as $index => $item) {
            Telemetry::create(array_merge($item, [
                'vehicle_id' => 'TRUCK-01',
                'gsm' => 'Connected',
                'wifi' => 'Connected',
                'recorded_at' => now()->subMinutes((7 - $index) * 5),
            ]));
        }
    }
}
