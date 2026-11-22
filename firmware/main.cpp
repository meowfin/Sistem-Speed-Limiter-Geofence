#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPS++.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <math.h>
#include "DHT.h"

// ==========================================
// 1. KONFIGURASI JARINGAN & MQTT
// ==========================================
const char* ssid = "Javanesia";
const char* password = "Qwertyz103";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port = 1883;

const char* topic_pub       = "unsoed/wokwi/esp32gpsTK24/sensor";
const char* topic_sub_cmd   = "unsoed/wokwi/esp32gpsTK24/command";
const char* topic_sub_zones = "unsoed/wokwi/esp32gpsTK24/zones";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 2. KONFIGURASI PIN
// ==========================================
#define GPS_RX     16
#define GPS_TX     17
#define SERVO_PIN  19  // Pin Signal Servo MG90S
#define DHTPIN     4   // Pin Sensor DHT22
#define IN1        25  // Pin IN1 L298N Mini (PWM)
#define IN2        26  // Pin IN2 L298N Mini
#define OPTO_PIN   33  // Sesuaikan ke pin 33

// Konfigurasi Kanal PWM khusus Motor agar tidak bentrok dengan Servo
#define MOTOR_PWM_CHANNEL 8
#define MOTOR_PWM_FREQ    1000 // 1 kHz
#define MOTOR_PWM_RES     8    // Resolusi 8-bit (0 - 255)

// ==========================================
// 3. STRUKTUR DATA ZONA LOKAL (EDGE GEOFENCE)
// ==========================================
#define MAX_ZONES 30

struct LocalZone {
  String category; // "school", "toll", atau "destination"
  double lat;
  double lng;
  float radius;
};

LocalZone localZones[MAX_ZONES];
int totalZones = 0;

// ==========================================
// 4. OBJEK & VARIABEL GLOBAL
// ==========================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
Servo boxServo;
DHT dht(DHTPIN, DHT22);

bool isBoxLocked = true;
bool inSlowZone  = false;
bool inTollZone  = false;
bool isArrived   = false;
int targetSpeed  = 180; // Default kecepatan normal (0 - 255)

unsigned long lastDhtTime  = 0;
unsigned long lastMqttTime = 0;
float currentTemp = 0.0;
float currentHum  = 0.0;

// Variabel Interrupt Optocoupler (1 Celah = 1 Putaran)
volatile unsigned long lastPulseMicros      = 0;
volatile unsigned long revolutionTimeMicros = 0;
volatile bool newPulse = false;
float currentRpm = 0.0;

// ==========================================
// 5. INTERRUPT OPTOCOUPLER (1 CELAH)
// ==========================================
void IRAM_ATTR onPulseDetected() {
  unsigned long now  = micros();
  unsigned long diff = now - lastPulseMicros;

  // Debounce 20.000 mikrodetik (20 ms) agar serabut/getaran karton tidak terbaca ganda
  if (diff > 20000) {
    revolutionTimeMicros = diff;
    lastPulseMicros      = now;
    newPulse             = true;
  }
}

void updateRpm() {
  if (newPulse) {
    noInterrupts();
    unsigned long revTime = revolutionTimeMicros;
    newPulse = false;
    interrupts();

    // 1 menit = 60.000.000 mikrodetik (untuk 1 celah / 1 putaran penuh)
    currentRpm = 60000000.0 / (float)revTime;
  } else if (micros() - lastPulseMicros > 1500000) {
    // Jika lebih dari 1,5 detik tidak ada celah melintas, roda dianggap berhenti
    currentRpm = 0.0;
  }
}

// ==========================================
// 6. KONTROL MOTOR DC (L298N MINI) & SERVO
// ==========================================
void terapkanKecepatanMotor(int pwm) {
  pwm = constrain(pwm, 0, 255);
  ledcWrite(MOTOR_PWM_CHANNEL, pwm);
  digitalWrite(IN2, LOW);
}

void putarBuka() {
  Serial.println("[SERVO] Membuka Kunci...");
  boxServo.write(90);
  isBoxLocked = false;
}

void putarKunci() {
  Serial.println("[SERVO] Mengunci...");
  boxServo.write(0);
  isBoxLocked = true;
}

// ==========================================
// 7. PERHITUNGAN JARAK HAVERSINE LOKAL (< 1 ms)
// ==========================================
double hitungJarakMeter(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0;
  double dLat = radians(lat2 - lat1);
  double dLon = radians(lon2 - lon1);
  double a = sin(dLat / 2.0) * sin(dLat / 2.0) +
             cos(radians(lat1)) * cos(radians(lat2)) *
             sin(dLon / 2.0) * sin(dLon / 2.0);
  double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  return R * c;
}

void evaluasiZonaLokal(double currentLat, double currentLng) {
  bool prevArrived = isArrived;
  inSlowZone = false;
  inTollZone = false;
  isArrived  = false;

  for (int i = 0; i < totalZones; i++) {
    double jarak = hitungJarakMeter(currentLat, currentLng, localZones[i].lat, localZones[i].lng);

    if (jarak <= localZones[i].radius) {
      if (localZones[i].category == "school") {
        inSlowZone = true;
      } else if (localZones[i].category == "toll") {
        inTollZone = true;
      } else if (localZones[i].category == "destination") {
        isArrived = true;
      }
    }
  }

  // Penentuan target kecepatan berdasarkan prioritas zona:
  // Tujuan (Stop) > Zona Sekolah (Lambat) > Zona Tol (Cepat) > Normal
  if (isArrived) {
    targetSpeed = 0;
    if (!prevArrived && isBoxLocked) {
      putarBuka();
    }
  } else if (inSlowZone) {
    targetSpeed = 120; // Kecepatan lambat di Zona Sekolah (sesuaikan jika motor butuh torsi lebih)
  } else if (inTollZone) {
    targetSpeed = 255; // Kecepatan penuh di Zona Tol
  } else {
    targetSpeed = 180; // Kecepatan normal jalan raya
  }

  terapkanKecepatanMotor(targetSpeed);
}

// ==========================================
// 8. PARSING DAFTAR ZONA DARI LARAVEL
// ==========================================
void simpanZonaDariJson(String jsonPayload) {
  DynamicJsonDocument doc(4096);
  DeserializationError error = deserializeJson(doc, jsonPayload);

  if (error) {
    Serial.print("[ZONES] Gagal parse JSON zona: ");
    Serial.println(error.c_str());
    return;
  }

  JsonArray arr = doc.as<JsonArray>();
  totalZones = 0;

  for (JsonObject z : arr) {
    if (totalZones >= MAX_ZONES) break;
    localZones[totalZones].category = z["category"].as<String>();
    localZones[totalZones].lat      = z["lat"].as<double>();
    localZones[totalZones].lng      = z["lng"].as<double>();
    localZones[totalZones].radius   = z["radius"].as<float>();
    totalZones++;
  }

  Serial.print("[ZONES] Berhasil sinkronisasi ");
  Serial.print(totalZones);
  Serial.println(" titik zona ke memori ESP32!");
}

// ==========================================
// 9. MQTT CALLBACK (COMMAND & ZONES)
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  String topicStr = String(topic);

  if (topicStr == topic_sub_cmd) {
    if (message == "UNLOCK" && isBoxLocked) {
      putarBuka();
    } else if (message == "LOCK" && !isBoxLocked) {
      putarKunci();
    } else if (message.startsWith("SET_SPEED:")) {
      targetSpeed = message.substring(10).toInt();
      terapkanKecepatanMotor(targetSpeed);
      Serial.print("[CMD] Target Speed diubah server ke: ");
      Serial.println(targetSpeed);
    }
  } else if (topicStr == topic_sub_zones) {
    simpanZonaDariJson(message);
  }
}

// ==========================================
// 10. KONEKSI WIFI & MQTT
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
      client.subscribe(topic_sub_cmd);
      client.subscribe(topic_sub_zones);
      Serial.println("MQTT Terhubung & Subscribe Command + Zones!");
    } else {
      delay(5000);
    }
  }
}

// ==========================================
// 11. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Init Motor DC L298N Mini
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  terapkanKecepatanMotor(targetSpeed);

  // Init Optocoupler Interrupt
  pinMode(OPTO_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(OPTO_PIN), onPulseDetected, RISING);

  // Init GPS & DHT22
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  dht.begin();

  // Init Servo MG90S
  boxServo.setPeriodHertz(50);
  boxServo.attach(SERVO_PIN, 500, 2400);
  boxServo.write(0);
  isBoxLocked = true;

  // Init Jaringan
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(4096);
  client.setCallback(callback);

  Serial.println("Sistem Full Smart Logistic Tracker Siap!");
}

// ==========================================
// 12. LOOP UTAMA
// ==========================================
void loop() {
  // Baca data serial GPS terus-menerus
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Jaga koneksi MQTT
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Hitung RPM roda terbaru dari optocoupler
  updateRpm();

  // Evaluasi Geofence secara lokal setiap kali GPS mendapat update koordinat valid
  if (gps.location.isUpdated() && gps.location.isValid()) {
    evaluasiZonaLokal(gps.location.lat(), gps.location.lng());
  }

  // Baca suhu & kelembapan setiap 2 detik
  if (millis() - lastDhtTime >= 2000) {
    lastDhtTime = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHum  = h;
    }
  }

  // Kirim seluruh data telemetri ke Laravel setiap 1,5 detik
  if (millis() - lastMqttTime >= 1500) {
    lastMqttTime = millis();
    if (client.connected()) {
      StaticJsonDocument<384> doc;
      doc["lat"]          = gps.location.isValid() ? gps.location.lat() : 0.0;
      doc["lng"]          = gps.location.isValid() ? gps.location.lng() : 0.0;
      doc["satelit"]      = gps.satellites.value();
      doc["rpm"]          = round(currentRpm);
      doc["temp"]         = currentTemp;
      doc["hum"]          = currentHum;
      doc["lock"]         = isBoxLocked ? "LOCKED" : "UNLOCKED";
      doc["target_speed"] = targetSpeed;
      doc["in_zone"]      = inSlowZone;
      doc["arrived"]      = isArrived;

      char buffer[384];
      serializeJson(doc, buffer);
      client.publish(topic_pub, buffer);

      Serial.print("Data Terkirim: ");
      Serial.println(buffer);
    }
  }
}