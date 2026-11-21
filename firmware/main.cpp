
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <TinyGPS++.h>
#include <ESP32Servo.h>
#include <math.h>

// ==================================================
// KONFIGURASI WIFI
// ==================================================

// Ganti dengan nama dan password WiFi milik kamu.
const char* WIFI_SSID = "NAMA_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

// ==================================================
// KONFIGURASI SENSOR DHT22
// ==================================================

#define DHTPIN 4
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

float hum = 0;
float temp = 0;
float batt = 100;

// ==================================================
// KONFIGURASI SERVO (KUNCI BOX)
// ==================================================

#define SERVO_PIN 18

#define SERVO_MIN_US 500
#define SERVO_MAX_US 2400

#define SERVO_LOCK_ANGLE 0
#define SERVO_UNLOCK_ANGLE 90

Servo myServo;

String lockStatus = "LOCKED";

// ==================================================
// KONFIGURASI MOTOR DC (L298N)
// ==================================================

#define MOTOR_ENA 25
#define MOTOR_IN1 26
#define MOTOR_IN2 27

// ==================================================
// KONFIGURASI SENSOR RPM (OPTOCOUPLER)
// ==================================================

#define OPTO_PIN 34

volatile unsigned long pulseCount = 0;

const float PULSES_PER_REV = 20.0;

// Pengaman akses variabel pulseCount dari interrupt.
portMUX_TYPE pulseMux = portMUX_INITIALIZER_UNLOCKED;

// ==================================================
// VARIABEL PID
// ==================================================

float targetRPM = 0;
float rpmActual = 0;

unsigned long lastTimePID = 0;

float Kp = 1.5;
float Ki = 0.5;
float Kd = 0.1;

float error = 0;
float prevError = 0;
float integral = 0;

// ==================================================
// KONFIGURASI MQTT
// ==================================================

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

// Topic tetap sama dengan konfigurasi backend Laravel.
const char* topic_publish =
    "unsoed/wokwi/esp32gpsTK24/sensor";

const char* topic_subscribe =
    "unsoed/wokwi/esp32gpsTK24/command";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ==================================================
// KONFIGURASI GPS NEO-6M
// ==================================================

TinyGPSPlus gps;

String lat_data = "0";
String lng_data = "0";

#define GPS_BAUDRATE 9600

#define RX2_PIN 16
#define TX2_PIN 17

// ==================================================
// KONFIGURASI TUJUAN DAN GEOFENCE
// ==================================================

// Koordinat tujuan.
const double DEST_LAT = -7.424883;
const double DEST_LNG = 109.229367;

const double UNLOCK_RADIUS_M = 20.0;

// Zona lambat (zona sekolah).
const double ZONE_LAT = -7.425000;
const double ZONE_LNG = 109.229000;

const double ZONE_RADIUS_M = 10.0;

// Target RPM.
const int RPM_ZONA_LAMBAT = 100;
const int RPM_BEBAS = 255;

bool arrived = false;
bool inZone = false;

// ==================================================
// FUNGSI MENGHITUNG JARAK
// ==================================================

double distanceTo(double lat, double lng) {

    if (!gps.location.isValid()) {
        return -1;
    }

    return TinyGPSPlus::distanceBetween(
        gps.location.lat(),
        gps.location.lng(),
        lat,
        lng
    );
}

// ==================================================
// FUNGSI MEMERIKSA KEDATANGAN
// ==================================================

void updateArrival() {

    if (arrived) {
        return;
    }

    double d = distanceTo(DEST_LAT, DEST_LNG);

    if (d >= 0 && d <= UNLOCK_RADIUS_M) {

        arrived = true;

        Serial.println(
            ">> SAMPAI TUJUAN. UNLOCK diizinkan."
        );
    }
}

// ==================================================
// FUNGSI MEMERIKSA GEOFENCE
// ==================================================

void updateZone() {

    double d = distanceTo(ZONE_LAT, ZONE_LNG);

    if (d >= 0 && d <= ZONE_RADIUS_M) {
        inZone = true;
    } else {
        inZone = false;
    }
}

// ==================================================
// INTERRUPT SENSOR RPM
// ==================================================

void IRAM_ATTR countPulse() {

    portENTER_CRITICAL_ISR(&pulseMux);

    pulseCount++;

    portEXIT_CRITICAL_ISR(&pulseMux);
}

// ==================================================
// CALLBACK MQTT
// ==================================================

void mqttCallback(
    char* topic,
    byte* payload,
    unsigned int length
) {

    String message;

    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }

    message.trim();
    message.toUpperCase();

    Serial.print("Perintah MQTT: ");
    Serial.println(message);

    if (message == "LOCK") {

        myServo.write(SERVO_LOCK_ANGLE);

        lockStatus = "LOCKED";

        Serial.println(">> BOX TERKUNCI");
    }

    else if (message == "UNLOCK") {

        if (arrived) {

            myServo.write(SERVO_UNLOCK_ANGLE);

            lockStatus = "UNLOCKED";

            Serial.println(">> BOX TERBUKA");

        } else {

            Serial.println(
                ">> UNLOCK DITOLAK: Belum sampai tujuan."
            );
        }
    }
}

// ==================================================
// KONEKSI WIFI
// ==================================================

void connectWiFi() {

    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    Serial.println();
    Serial.print("Menghubungkan WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startAttempt = millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - startAttempt < 15000
    ) {

        delay(500);

        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {

        Serial.println();
        Serial.println("WiFi berhasil terhubung!");

        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());

    } else {

        Serial.println();
        Serial.println("WiFi belum terhubung.");
    }
}

// ==================================================
// KONEKSI MQTT
// ==================================================

void reconnectMQTT() {

    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    while (!mqttClient.connected()) {

        Serial.print("Menghubungkan MQTT...");

        String clientId =
            "ESP32GPS-" +
            String(random(0xffff), HEX);

        if (mqttClient.connect(clientId.c_str())) {

            Serial.println(" berhasil!");

            mqttClient.subscribe(topic_subscribe);

            Serial.println(
                "Berhasil subscribe topic command."
            );

        } else {

            Serial.print(" gagal. State: ");
            Serial.println(mqttClient.state());

            delay(3000);

            // Jangan terus mencoba jika WiFi terputus.
            if (WiFi.status() != WL_CONNECTED) {
                break;
            }
        }
    }
}

// ==================================================
// SETUP
// ==================================================

void setup() {

    Serial.begin(115200);

    // GPS NEO-6M.
    Serial2.begin(
        GPS_BAUDRATE,
        SERIAL_8N1,
        RX2_PIN,
        TX2_PIN
    );

    // Sensor DHT22.
    dht.begin();

    // Servo.
    myServo.setPeriodHertz(50);

    myServo.attach(
        SERVO_PIN,
        SERVO_MIN_US,
        SERVO_MAX_US
    );

    myServo.write(SERVO_LOCK_ANGLE);

    // Motor DC.
    pinMode(MOTOR_ENA, OUTPUT);
    pinMode(MOTOR_IN1, OUTPUT);
    pinMode(MOTOR_IN2, OUTPUT);

    digitalWrite(MOTOR_IN1, HIGH);
    digitalWrite(MOTOR_IN2, LOW);

    analogWrite(MOTOR_ENA, 0);

    // Sensor RPM.
    // GPIO34 tidak memiliki internal pull-up.
    // Gunakan resistor pull-up eksternal jika sensor memerlukannya.
    pinMode(OPTO_PIN, INPUT);

    attachInterrupt(
        digitalPinToInterrupt(OPTO_PIN),
        countPulse,
        RISING
    );

    // WiFi.
    connectWiFi();

    // MQTT.
    mqttClient.setServer(mqtt_server, mqtt_port);
    mqttClient.setCallback(mqttCallback);

    mqttClient.setKeepAlive(30);

    lastTimePID = millis();

    Serial.println();
    Serial.println("================================");
    Serial.println("SISTEM SPEED LIMITER GEOFENCE");
    Serial.println("ESP32 HARDWARE");
    Serial.println("================================");
}

// ==================================================
// LOOP
// ==================================================

void loop() {

    // ----------------------------------------------
    // 1. MEMBACA DATA GPS
    // ----------------------------------------------

    while (Serial2.available() > 0) {

        if (gps.encode(Serial2.read())) {

            if (gps.location.isValid()) {

                lat_data = String(
                    gps.location.lat(),
                    6
                );

                lng_data = String(
                    gps.location.lng(),
                    6
                );

                updateArrival();

                updateZone();
            }
        }
    }

    // ----------------------------------------------
    // 2. KENDALI PID (10 Hz)
    // ----------------------------------------------

    if (millis() - lastTimePID >= 100) {

        unsigned long currentTime = millis();

        float dt =
            (currentTime - lastTimePID) / 1000.0;

        lastTimePID = currentTime;

        // Mengambil jumlah pulsa secara aman.
        unsigned long pulses;

        portENTER_CRITICAL(&pulseMux);

        pulses = pulseCount;

        pulseCount = 0;

        portEXIT_CRITICAL(&pulseMux);

        // Menghitung RPM.
        float revolutions =
            pulses / PULSES_PER_REV;

        rpmActual =
            (revolutions / dt) * 60.0;

        // Menentukan target RPM berdasarkan zona.
        targetRPM = inZone
            ? RPM_ZONA_LAMBAT
            : RPM_BEBAS;

        // Fail-safe jika GPS tidak valid.
        if (!gps.location.isValid()) {
            targetRPM = 0;
        }

        // Perhitungan PID.
        error = targetRPM - rpmActual;

        integral += error * dt;

        integral = constrain(
            integral,
            -100,
            100
        );

        float derivative =
            (error - prevError) / dt;

        float outputPID =
            (Kp * error) +
            (Ki * integral) +
            (Kd * derivative);

        prevError = error;

        int pwmValue = constrain(
            (int)outputPID,
            0,
            255
        );

        analogWrite(MOTOR_ENA, pwmValue);
    }

    // ----------------------------------------------
    // 3. MEMERIKSA KONEKSI WIFI
    // ----------------------------------------------

    static unsigned long lastWiFiAttempt = 0;

    if (
        WiFi.status() != WL_CONNECTED &&
        millis() - lastWiFiAttempt >= 10000
    ) {

        lastWiFiAttempt = millis();

        connectWiFi();
    }

    // ----------------------------------------------
    // 4. KONEKSI MQTT
    // ----------------------------------------------

    if (WiFi.status() == WL_CONNECTED) {

        if (!mqttClient.connected()) {
            reconnectMQTT();
        }

        mqttClient.loop();
    }

    // ----------------------------------------------
    // 5. PUBLISH DATA SENSOR SETIAP 5 DETIK
    // ----------------------------------------------

    static unsigned long previousMillisMQTT = 0;

    if (
        millis() - previousMillisMQTT >= 5000
    ) {

        previousMillisMQTT = millis();

        // Membaca sensor DHT22.
        hum = dht.readHumidity();

        temp = dht.readTemperature();

        // Mengirim hanya jika MQTT dan GPS siap.
        if (
            mqttClient.connected() &&
            gps.location.isValid()
        ) {

            double dist = distanceTo(
                DEST_LAT,
                DEST_LNG
            );

            // Menghindari JSON tidak valid jika DHT gagal membaca.
            char humValue[16];
            char tempValue[16];

            if (isnan(hum)) {
                snprintf(humValue, sizeof(humValue), "null");
            } else {
                snprintf(
                    humValue,
                    sizeof(humValue),
                    "%.1f",
                    hum
                );
            }

            if (isnan(temp)) {
                snprintf(tempValue, sizeof(tempValue), "null");
            } else {
                snprintf(
                    tempValue,
                    sizeof(tempValue),
                    "%.1f",
                    temp
                );
            }

            // Membentuk payload JSON.
            char payload[320];

            snprintf(
                payload,
                sizeof(payload),

                "{\"lat\":%s,"
                "\"lng\":%s,"
                "\"hum\":%s,"
                "\"temp\":%s,"
                "\"batt\":%.1f,"
                "\"lock\":\"%s\","
                "\"dist\":%.1f,"
                "\"arrived\":%s,"
                "\"rpm\":%.1f,"
                "\"inZone\":%s}",

                lat_data.c_str(),
                lng_data.c_str(),
                humValue,
                tempValue,
                batt,
                lockStatus.c_str(),
                dist,
                arrived ? "true" : "false",
                rpmActual,
                inZone ? "true" : "false"
            );

            // Mengirim data ke broker MQTT.
            bool sent = mqttClient.publish(
                topic_publish,
                payload
            );

            if (sent) {

                Serial.println();
                Serial.println("Data MQTT terkirim:");
                Serial.println(payload);

            } else {

                Serial.println(
                    "Gagal mengirim data MQTT."
                );
            }

            // Nilai baterai ini masih simulasi.
            batt -= 0.5;

            if (batt < 0) {
                batt = 100;
            }
        }
    }
}
