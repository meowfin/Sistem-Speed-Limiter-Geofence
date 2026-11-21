<?php

return [

    'host' => env('MQTT_HOST', 'broker.emqx.io'),
    'port' => (int) env('MQTT_PORT', 1883),
    'client_id' => env('MQTT_CLIENT_ID'),

    // Topik harus sama dengan firmware/main.cpp
    'topics' => [
        'sensor' => env('MQTT_TOPIC_SENSOR', 'unsoed/wokwi/esp32gpsTK24/sensor'),
        'command' => env('MQTT_TOPIC_COMMAND', 'unsoed/wokwi/esp32gpsTK24/command'),
    ],

    'vehicle_id' => env('VEHICLE_ID', 'TRUCK-01'),
];
