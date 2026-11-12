<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MqttSubscribeCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'mqtt:listen';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Listen to MQTT telemetry topics';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        //
    }
}