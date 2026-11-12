<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Telemetry extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'latitude', 'longitude', 'speed', 'rpm',
        'temperature', 'humidity', 'battery', 'lock', 'arrived',
        'gsm', 'wifi', 'recorded_at',
    ];

    protected $casts = [
        'arrived' => 'boolean',
        'recorded_at' => 'datetime',
    ];
}