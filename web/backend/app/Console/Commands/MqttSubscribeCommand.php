<?php

namespace App\Console\Commands;

use App\Services\MqttService;
use Illuminate\Console\Command;
use PhpMqtt\Client\Facades\MQTT;

class MqttSubscribeCommand extends Command
{
    protected $signature = 'mqtt:listen';

    protected $description = 'Listen to MQTT telemetry topics';

    public function handle(MqttService $service): int
    {
        $topic = config('mqtt.topics.sensor');
        $mqtt = MQTT::connection();

        $this->info("Subscribe ke {$topic} (Ctrl+C untuk berhenti)");

        $mqtt->subscribe($topic, function (string $topic, string $message) use ($service) {
            $row = $service->ingest($message);
            $this->line('['.now()->format('H:i:s').'] '.($row ? "telemetri #{$row->id} disimpan" : 'payload diabaikan'));
        }, 0);

        $mqtt->loop(true);

        return self::SUCCESS;
    }
}
