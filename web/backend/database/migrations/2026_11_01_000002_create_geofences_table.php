<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geofences', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('zone_category')->default('school'); // 'school', 'toll', 'destination'
            $table->string('type')->default('circle');          // 'circle' atau 'polyline'
            $table->decimal('center_lat', 10, 7)->nullable();
            $table->decimal('center_lng', 10, 7)->nullable();
            $table->unsignedInteger('radius_meters')->default(20); // Radius lingkaran ATAU buffer lebar jalan tol
            $table->json('path_points')->nullable();            // Array koordinat untuk polyline tol
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geofences');
    }
};
