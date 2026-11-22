<?php

namespace Database\Seeders;

use App\Models\Geofence;
use Illuminate\Database\Seeder;

class GeofenceSeeder extends Seeder
{
    /** Koordinat dan radius sama dengan konstanta di firmware/main.cpp */
    public function run(): void
    {
        Geofence::truncate();

        // 1. Jalur Simulasi Tol (Polyline dengan buffer lebar 20 meter)
        Geofence::create([
            'name'          => 'Zona Tol (Kalimanah - Bung Karno)',
            'zone_category' => 'toll',
            'type'          => 'polyline',
            'radius_meters' => 40,
            'path_points'   => [
                ['lat' => -7.424523, 'lng' => 109.337491],
                ['lat' => -7.420542, 'lng' => 109.338474],
                ['lat' => -7.414436, 'lng' => 109.340034],
                ['lat' => -7.405660, 'lng' => 109.345927],
                ['lat' => -7.402767, 'lng' => 109.347953],
                ['lat' => -7.398738, 'lng' => 109.347409],
                ['lat' => -7.398690, 'lng' => 109.349631],
                ['lat' => -7.399374, 'lng' => 109.350526],
                ['lat' => -7.402058, 'lng' => 109.351516],
            ],
        ]);
        
        Geofence::create([
            'name'          => 'Zona Lambat (Zona Sekolah)',
            'zone_category' => 'school',
            'type'          => 'circle',
            'center_lat'    => -7.407100,
            'center_lng'    => 109.344950,
            'radius_meters' => 35,
        ]);

        Geofence::create([
            'name'          => 'Zona Sekolah 1 (FT)',
            'zone_category' => 'school',
            'type'          => 'circle',
            'center_lat'    => -7.428964,
            'center_lng'    => 109.336198,
            'radius_meters' => 30,
        ]);

        // 3. Sekolah 2 (SDN 1 Blater)
        Geofence::create([
            'name'          => 'Zona Toll',
            'zone_category' => 'toll',
            'type'          => 'circle',
            'center_lat'    => -7.432399,
            'center_lng'    => 109.339648,
            'radius_meters' => 50,
        ]);

        // 4. Sekolah 3 (Redjo Mulyo Blater 2)
        Geofence::create([
            'name'          => 'Zona Sekolah 3 (Redjo Mulyo Blater 2)',
            'zone_category' => 'school',
            'type'          => 'circle',
            'center_lat'    => -7.426520,
            'center_lng'    => 109.336605,
            'radius_meters' => 30,
        ]);

        // 5. Titik Tujuan (Auto Stop & Unlock)
        Geofence::create([
            'name'          => 'Tujuan (Zona Unlock)',
            'zone_category' => 'destination',
            'type'          => 'circle',
            'center_lat'    => -7.428085,
            'center_lng'    => 109.336532,
            'radius_meters' => 50,
        ]);
    }
}
