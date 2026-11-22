<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Geofence extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'zone_category',
        'type',
        'center_lat',
        'center_lng',
        'radius_meters',
        'path_points',
    ];

    protected $casts = [
        'center_lat'    => 'float',
        'center_lng'    => 'float',
        'radius_meters' => 'integer',
        'path_points'   => 'array',
    ];
}