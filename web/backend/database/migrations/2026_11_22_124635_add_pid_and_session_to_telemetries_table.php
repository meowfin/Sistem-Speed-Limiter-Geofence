<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('telemetries', function (Blueprint $table) {
            $table->string('trip_session')->nullable()->index()->after('vehicle_id');
            $table->double('setpoint_rpm')->nullable()->after('rpm');
            $table->double('pid_error')->nullable()->after('setpoint_rpm');
            $table->integer('pwm_out')->nullable()->after('pid_error');
            $table->string('pid_mode', 10)->default('AUTO')->after('pwm_out');
            $table->double('speed_mps')->nullable()->after('speed');
            $table->double('speed_kmh')->nullable()->after('speed_mps');
        });
    }

    public function down(): void
    {
        Schema::table('telemetries', function (Blueprint $table) {
            $table->dropColumn([
                'trip_session',
                'setpoint_rpm',
                'pid_error',
                'pwm_out',
                'pid_mode',
                'speed_mps',
                'speed_kmh',
            ]);
        });
    }
};