<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

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
            [
                'name'     => 'Test User',
                'password' => Hash::make('password'), // ← tambahkan ini
                // opsional, kalau model User Anda punya kolom role:
                // 'role' => 'admin',
            ]
        );

        // Menjalankan seeder geofence dan telemetry
        $this->call([
            GeofenceSeeder::class,
            TelemetrySeeder::class,
        ]);
    }
}
