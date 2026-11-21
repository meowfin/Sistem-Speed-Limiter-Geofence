<?php

namespace Database\Seeders;

use App\Models\Geofence;
use Illuminate\Database\Seeder;

class GeofenceSeeder extends Seeder
{
    /** Koordinat dan radius sama dengan konstanta di firmware/main.cpp */
    public function run(): void
    {
        Geofence::updateOrCreate(
            ['name' => 'Zona Lambat (Zona Sekolah)'],
            ['center_lat' => -7.425000, 'center_lng' => 109.229000, 'radius_meters' => 10],
        );
        Geofence::updateOrCreate(
            ['name' => 'Tujuan (Zona Unlock)'],
            ['center_lat' => -7.424883, 'center_lng' => 109.229367, 'radius_meters' => 20],
        );
    }
}
