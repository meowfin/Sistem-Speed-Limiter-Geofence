#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPS++.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ==========================================
// 1. KONFIGURASI JARINGAN & MQTT
// ==========================================
const char* ssid = "NAMA_WIFI_KAMU"; // GANTI DENGAN WIFI KAMU
const char* password = "PASSWORD_WIFI_KAMU";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port = 1883;

const char* topic_pub = "unsoed/wokwi/esp32gpsTK24/sensor";
const char* topic_sub = "unsoed/wokwi/esp32gpsTK24/command";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 2. KONFIGURASI PIN
// ==========================================
#define GPS_RX 16
#define GPS_TX 17
#define SERVO_PIN 19  // Pin Signal Servo (GPIO 19)
#define DHTPIN 4      // Pin DHT22 (GPIO 4)

// ==========================================
// 3. OBJEK & VARIABEL GLOBAL
// ==========================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
Servo boxServo;
DHT dht(DHTPIN, DHT22);

bool isBoxLocked = true;
unsigned long lastDhtTime = 0;
unsigned long lastMqttTime = 0;
float currentTemp = 0, currentHum = 0;

// ==========================================
// 4. FUNGSI SERVO (MG90S 180 Derajat)
// ==========================================
void putarBuka() {
  Serial.println("Membuka Kunci...");
  boxServo.write(90); // Putar ke 90 derajat
  isBoxLocked = false;
}

void putarKunci() {
  Serial.println("Mengunci...");
  boxServo.write(0);  // Putar ke 0 derajat
  isBoxLocked = true;
}

// ==========================================
// 5. FUNGSI MQTT CALLBACK
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  if (message == "UNLOCK" && isBoxLocked) {
    putarBuka();
  } else if (message == "LOCK" && !isBoxLocked) {
    putarKunci();
  }
}

// ==========================================
// 6. FUNGSI KONEKSI WIFI & MQTT
// ==========================================
void setupWiFi() {
  Serial.print("Konek WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung!");
}

void reconnectMQTT() {
  while (!client.connected()) {
    String clientId = "ESP32Tracker-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      client.subscribe(topic_sub);
    } else {
      delay(5000);
    }
  }
}

// ==========================================
// 7. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  dht.begin();
  
  // Init Servo MG90S
  boxServo.setPeriodHertz(50);
  boxServo.attach(SERVO_PIN, 500, 2400);
  boxServo.write(0); // Mulai dengan posisi terkunci
  isBoxLocked = true;
  
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  
  Serial.println("Sistem GPS + Servo MG90S + DHT Siap!");
}

// ==========================================
// 8. LOOP UTAMA
// ==========================================
void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  if (millis() - lastDhtTime >= 2000) {
    lastDhtTime = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHum = h;
    }
  }

  if (millis() - lastMqttTime >= 3000) {
    lastMqttTime = millis();
    if (client.connected()) {
      StaticJsonDocument<256> doc;
      doc["lat"] = gps.location.isValid() ? gps.location.lat() : 0.0;
      doc["lng"] = gps.location.isValid() ? gps.location.lng() : 0.0;
      doc["satelit"] = gps.satellites.value();
      doc["temp"] = currentTemp;
      doc["hum"] = currentHum;
      doc["lock"] = isBoxLocked ? "LOCKED" : "UNLOCKED";

      char buffer[256];
      serializeJson(doc, buffer);
      client.publish(topic_pub, buffer);
      Serial.print("Data Terkirim: ");
      Serial.println(buffer);
    }
  }
}