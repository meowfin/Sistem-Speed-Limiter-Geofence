<?php

use PhpMqtt\Client\MqttClient;
use PhpMqtt\Client\Repositories\MemoryRepository;

$default = [
    'host' => env('MQTT_HOST', 'broker.emqx.io'),
    'port' => (int) env('MQTT_PORT', 1883),
    'protocol' => MqttClient::MQTT_3_1_1,
    'client_id' => env('MQTT_CLIENT_ID'),
    'use_clean_session' => false,
    'enable_logging' => true,
    'log_channel' => null,
    'repository' => MemoryRepository::class,
    'connection_settings' => [
        'tls' => ['enabled' => false],
        'auth' => ['username' => null, 'password' => null],
        'last_will' => ['topic' => null, 'message' => null, 'quality_of_service' => 0, 'retain' => false],
        'connect_timeout' => 10,
        'socket_timeout' => 5,
        'resend_timeout' => 10,
        'keep_alive_interval' => 10,
        'auto_reconnect' => [
            'enabled' => true,
            'max_reconnect_attempts' => 5,
            'delay_between_reconnect_attempts' => 1,
        ],
    ],
];

return [
    'default_connection' => 'default',
    'connections' => [
        'default'   => $default,
        'publisher' => array_merge($default, ['client_id' => null]), // id acak
    ],
];