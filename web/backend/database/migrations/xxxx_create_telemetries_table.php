<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telemetries', function (Blueprint $table) {
            $table->id();
            $table->string('vehicle_id');
            $table->double('latitude');
            $table->double('longitude');
            $table->double('speed')->nullable();
            $table->integer('rpm')->nullable();
            $table->double('temperature')->nullable();
            $table->double('humidity')->nullable();
            $table->double('battery')->nullable();
            $table->enum('lock', ['LOCKED', 'UNLOCKED'])->nullable();
            $table->boolean('arrived')->default(false);
            $table->boolean('in_zone')->default(false);
            $table->double('distance')->nullable();
            $table->string('gsm')->nullable();
            $table->string('wifi')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telemetries');
    }
};