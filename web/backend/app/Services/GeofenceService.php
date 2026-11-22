<?php

namespace App\Services;

use App\Models\Geofence;

class GeofenceService
{
    /**
     * Mengevaluasi posisi koordinat kendaraan terhadap seluruh zona di database.
     *
     * @return array{in_zone: bool, arrived: bool, distance: float|null}
     */
    public function evaluatePosition(float $lat, float$lng): array
    {
        $inZone = false;
        $arrived = false;
        $closestDistance = null;

        $zones = Geofence::all();

        foreach ($zones as$zone) {
            $distance =$this->haversine(
                $lat,$lng,
                (float) $zone->center_lat,
                (float) $zone->center_lng
            );

            // Simpan jarak terdekat (opsional untuk disimpan ke kolom distance)
            if ($closestDistance === null || $distance <$closestDistance) {
                $closestDistance = round($distance, 2);
            }

            if ($distance <=$zone->radius_meters) {
                if ($zone->name === 'Zona Lambat (Zona Sekolah)') {$inZone = true;
                } elseif ($zone->name === 'Tujuan (Zona Unlock)') {$arrived = true;
                }
            }
        }

        return [
            'in_zone'  => $inZone,
            'arrived'  => $arrived,
            'distance' => $closestDistance,
        ];
    }

    /**
     * Rumus Haversine untuk menghitung jarak antar koordinat (dalam meter).
     */
    public function haversine(float $lat1, float$lon1, float $lat2, float$lon2): float
    {
        $earthRadius = 6371000; // meter
        $latFrom = deg2rad($lat1);
        $lonFrom = deg2rad($lon1);
        $latTo   = deg2rad($lat2);
        $lonTo   = deg2rad($lon2);

        $latDelta = $latTo -$latFrom;
        $lonDelta = $lonTo -$lonFrom;

        $angle = 2 * asin(sqrt(
            pow(sin($latDelta / 2), 2) +
            cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)
        ));

        return $angle * $earthRadius;
    }
}