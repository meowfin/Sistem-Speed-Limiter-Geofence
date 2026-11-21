<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Membuat akun pengujian jika belum tersedia
        User::firstOrCreate(
            ['email' => 'test@example.com'],
            ['name' => 'Test User']
        );

        // Menjalankan seeder geofence dan telemetry
        $this->call([
            GeofenceSeeder::class,
            TelemetrySeeder::class,
        ]);
    }
}
