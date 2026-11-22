<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class PackageController extends Controller
{
    public function index()
    {
        return response()->json(
            Package::orderByDesc('id')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'item_name'        => 'required|string|max:255',
            'destination_name' => 'nullable|string|max:255',
        ]);

        $code = 'PKG-' . Carbon::now()->format('Ymd') . '-' . strtoupper(Str::random(4));

        $package = Package::create([
            'package_code'     => $code,
            'item_name'        => $data['item_name'],
            'destination_name' => $data['destination_name'] ?? 'Tujuan Pengiriman',
            'status'           => 'in_transit',
        ]);

        return response()->json([
            'status'  => 'ok',
            'package' => $package,
        ], 201);
    }

    public function verifyScan(Request $request)
    {
        $data = $request->validate([
            'package_code' => 'required|string',
        ]);

        $code = trim($data['package_code']);
        $package = Package::where('package_code', $code)->first();

        if (! $package) {
            return response()->json([
                'status'  => 'error',
                'message' => "Kode QR tidak terdaftar: $code",
            ], 404);
        }

        if ($package->status === 'delivered') {
            return response()->json([
                'status'  => 'warning',
                'message' => "Paket {$package->package_code} ({$package->item_name}) sudah diverifikasi sebelumnya.",
                'package' => $package,
            ]);
        }

        $package->update([
            'status'       => 'delivered',
            'delivered_at' => Carbon::now(),
        ]);

        ActivityLog::create([
            'vehicle_id' => config('mqtt.vehicle_id'),
            'action'     => 'QR_VERIFIED',
            'message'    => "Paket {$package->package_code} ({$package->item_name}) diterima & diverifikasi via QR",
        ]);

        return response()->json([
            'status'  => 'ok',
            'message' => "Berhasil! Paket {$package->item_name} ({$package->package_code}) terkonfirmasi diterima.",
            'package' => $package,
        ]);
    }

    public function destroy(Package $package)
    {
        $package->delete();
        return response()->json(['status' => 'ok']);
    }
}