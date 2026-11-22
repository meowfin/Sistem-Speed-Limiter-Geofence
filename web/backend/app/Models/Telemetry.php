<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Telemetry extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id',
        'trip_session',
        'latitude',
        'longitude',
        'speed',
        'speed_mps',
        'speed_kmh',
        'rpm',
        'setpoint_rpm',
        'pid_error',
        'pwm_out',
        'pid_mode',
        'temperature',
        'humidity',
        'battery',
        'lock',
        'arrived',
        'in_zone',
        'distance',
        'gsm',
        'wifi',
        'recorded_at',
    ];

    protected $casts = [
        'arrived' => 'boolean',
        'in_zone' => 'boolean',
        'recorded_at' => 'datetime',
    ];
}
