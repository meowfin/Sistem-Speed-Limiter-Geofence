#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <Wire.h>
#include "DHT.h"
#include <TinyGPS++.h>
#include <ESP32Servo.h>

// ===== Konfigurasi Sensor DHT =====
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);
float hum = 0, temp = 0, batt = 100;

// ===== Konfigurasi Servo (Kunci Box) =====
#define SERVO_PIN 18
#define SERVO_MIN_US 500
#define SERVO_MAX_US 2400
#define SERVO_LOCK_ANGLE   0
#define SERVO_UNLOCK_ANGLE 90
Servo myServo;
String lockStatus = "LOCKED";

// ===== KONFIGURASI MOTOR DC (L298N) =====
#define MOTOR_ENA 25 // Pin PWM
#define MOTOR_IN1 26
#define MOTOR_IN2 27

// ===== KONFIGURASI OPTOCOUPLER (Sensor RPM) =====
#define OPTO_PIN 34
volatile unsigned long pulseCount = 0;
const float PULSES_PER_REV = 20.0; // Sesuaikan dengan jumlah lubang piringan

// ===== VARIABEL PID =====
float targetRPM = 0.0;
float rpmActual = 0.0;
unsigned long lastTimePID = 0;
float Kp = 1.5, Ki = 0.5, Kd = 0.1;
float error = 0, prevError = 0, integral = 0;

// ===== Konfigurasi MQTT =====
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;
const char* topic_publish   = "unsoed/wokwi/esp32gpsTK24/sensor";
const char* topic_subscribe = "unsoed/wokwi/esp32gpsTK24/command";
WiFiClient   espClient;
PubSubClient mqttClient(espClient);

// ===== Konfigurasi GPS =====
TinyGPSPlus gps;
String lat_data = "0", lng_data = "0";
#define GPS_BAUDRATE 9600
#define RX2_PIN 16
#define TX2_PIN 17

// ===== Konfigurasi Tujuan & Zona Kecepatan =====
const double DEST_LAT = -7.424883;
const double DEST_LNG = 109.229367;
const double UNLOCK_RADIUS_M = 20.0; 

// Zona Lambat (Simulasi: Zona Sekolah)
const double ZONE_LAT = -7.425000; 
const double ZONE_LNG = 109.229000;
const double ZONE_RADIUS_M = 10.0; // Radius 10 meter
const int RPM_ZONA_LAMBAT = 100;
const int RPM_BEBAS = 255;

bool arrived = false;
bool inZone = false;

// ===== Fungsi Hitung Jarak (Haversine) =====
double distanceTo(double lat, double lng) {
  if (!gps.location.isValid()) return -1;
  return TinyGPSPlus::distanceBetween(gps.location.lat(), gps.location.lng(), lat, lng);
}

void updateArrival() {
  if (arrived) return;
  double d = distanceTo(DEST_LAT, DEST_LNG);
  if (d >= 0 && d <= UNLOCK_RADIUS_M) {
    arrived = true;
    Serial.println(F(">> SAMPAI TUJUAN. UNLOCK diizinkan."));
  }
}

void updateZone() {
  double d = distanceTo(ZONE_LAT, ZONE_LNG);
  if (d >= 0 && d <= ZONE_RADIUS_M) {
    inZone = true;
  } else {
    inZone = false;
  }
}

// ===== Interrupt Optocoupler =====
void IRAM_ATTR countPulse() {
  pulseCount++;
}

// ===== Callback MQTT =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  message.toUpperCase();

  if (message == "LOCK") {
    myServo.write(SERVO_LOCK_ANGLE);
    lockStatus = "LOCKED";
  }
  else if (message == "UNLOCK") {
    if (arrived) {
      myServo.write(SERVO_UNLOCK_ANGLE);
      lockStatus = "UNLOCKED";
    } else {
      Serial.println(">> UNLOCK DITOLAK: Belum sampai tujuan.");
    }
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    String clientId = "ESP32GPS-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      mqttClient.subscribe(topic_subscribe);
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(9600);
  Serial2.begin(GPS_BAUDRATE, SERIAL_8N1, RX2_PIN, TX2_PIN);
  
  dht.begin();
  
  // Setup Servo
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, SERVO_MIN_US, SERVO_MAX_US);
  myServo.write(SERVO_LOCK_ANGLE);
  
  // Setup Motor DC
  pinMode(MOTOR_ENA, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  digitalWrite(MOTOR_IN1, HIGH); // Arah maju
  digitalWrite(MOTOR_IN2, LOW);
  
  // Setup Optocoupler
  pinMode(OPTO_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(OPTO_PIN), countPulse, RISING);

  WiFi.mode(WIFI_STA);
  WiFi.begin("Wokwi-GUEST", ""); // Sesuaikan dengan WiFi kamu
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  
  lastTimePID = millis();
}

void loop() {
  // --- Baca GPS ---
  while (Serial2.available() > 0) {
    if (gps.encode(Serial2.read())) {
      if (gps.location.isValid()) {
        lat_data = String(gps.location.lat(), 6);
        lng_data = String(gps.location.lng(), 6);
        updateArrival();
        updateZone();
      }
    }
  }

  // --- Loop Kendali PID (10Hz) ---
  if (millis() - lastTimePID >= 100) {
    float dt = (millis() - lastTimePID) / 1000.0;
    lastTimePID = millis();

    // Hitung RPM
    float revolutions = pulseCount / PULSES_PER_REV;
    rpmActual = (revolutions / dt) * 60.0;
    pulseCount = 0;

    // Tentukan Target RPM berdasarkan Zona
    targetRPM = inZone ? RPM_ZONA_LAMBAT : RPM_BEBAS;
    if (!gps.location.isValid()) targetRPM = 0; // Fail-safe

    // Kalkulasi PID
    error = targetRPM - rpmActual;
    integral += error * dt;
    integral = constrain(integral, -100, 100);
    float derivative = (error - prevError) / dt;
    float outputPID = (Kp * error) + (Ki * integral) + (Kd * derivative);
    prevError = error;

    int pwmValue = constrain((int)outputPID, 0, 255);
    analogWrite(MOTOR_ENA, pwmValue);
  }

  // --- Koneksi MQTT ---
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  // --- Publish MQTT tiap 5 detik ---
  static unsigned long previousMillis_mqtt = 0;
  if (millis() - previousMillis_mqtt >= 5000) {
    previousMillis_mqtt = millis();
    hum = dht.readHumidity();
    temp = dht.readTemperature();

    if (mqttClient.connected()) {
      double dist = distanceTo(DEST_LAT, DEST_LNG);
      char payload[320];
      snprintf(payload, sizeof(payload),
        "{\"lat\":%s,\"lng\":%s,\"hum\":%.1f,\"temp\":%.1f,\"batt\":%.1f,\"lock\":\"%s\",\"dist\":%.1f,\"arrived\":%s,\"rpm\":%.1f,\"inZone\":%s}",
        lat_data.c_str(), lng_data.c_str(), hum, temp, batt,
        lockStatus.c_str(), dist, arrived ? "true" : "false",
        rpmActual, inZone ? "true" : "false");

      mqttClient.publish(topic_publish, payload);
      
      batt -= 0.5;
      if (batt < 0) batt = 100;
    }
  }
}