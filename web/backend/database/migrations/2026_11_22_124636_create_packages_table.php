<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->string('package_code')->unique(); // Kode unik yang di-encode ke QR Code
            $table->string('item_name');
            $table->string('destination_name')->nullable();
            $table->enum('status', ['in_transit', 'delivered'])->default('in_transit');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};