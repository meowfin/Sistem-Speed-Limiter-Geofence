<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TelemetryUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

    /** Channel publik "telemetry"; frontend: echo.channel('telemetry').listen('.telemetry.updated') */
    public function broadcastOn(): array
    {
        return [new Channel('telemetry')];
    }

    public function broadcastAs(): string
    {
        return 'telemetry.updated';
    }
}
