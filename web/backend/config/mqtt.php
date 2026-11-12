<?php

return [

    'host' => env('MQTT_HOST', 'broker.emqx.io'),
    'port' => (int) env('MQTT_PORT', 1883),
    'client_id' => env('MQTT_CLIENT_ID'),
];