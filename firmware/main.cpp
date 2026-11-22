#include <Arduino.h>
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
const char* ssid        = "Ventura10";
const char* password    = "katasandi2026";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;

const char* topic_pub       = "unsoed/wokwi/esp32gpsTK24/sensor";
const char* topic_sub_cmd   = "unsoed/wokwi/esp32gpsTK24/command";
const char* topic_sub_zones = "unsoed/wokwi/esp32gpsTK24/zones";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 2. KONFIGURASI PIN & PWM MOTOR (ESP32 CORE 3.x)
// ==========================================
#define GPS_RX     16
#define GPS_TX     17
#define SERVO_PIN  19  // Pin Signal Servo MG90S
#define DHTPIN     4   // Pin Sensor DHT22
#define IN1        25  // Pin IN1 L298N Mini (PWM)
#define IN2        26  // Pin IN2 L298N Mini
#define OPTO_PIN   33  // Pin Digital Output (DO) Optocoupler

#define MOTOR_PWM_CHANNEL 8     // Kanal tinggi agar tidak bentrok dengan Servo
#define MOTOR_PWM_FREQ    1000  // 1 kHz
#define MOTOR_PWM_RES     8     // Resolusi 8-bit (0 - 255)

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
int targetSpeed  = 180; // Default PWM normal (0 - 255)

unsigned long lastDhtTime  = 0;
unsigned long lastMqttTime = 0;
float currentTemp = 0.0;
float currentHum  = 0.0;

// Variabel Interrupt Optocoupler (Lengan Servo)
volatile unsigned long lastPulseMicros      = 0;
volatile unsigned long revolutionTimeMicros = 0;
volatile bool newPulse = false;
float currentRpm = 0.0;

// ==========================================
// 4B. VARIABEL KONTROL OTOMATIS PID (CLOSED-LOOP)
// ==========================================
bool pidEnabled             = true;   // true = Auto PID, false = Manual Open-Loop PWM
bool manualSetpointOverride = false;  // true = Gunakan setpoint dari dashboard, jangan ditimpa GPS
float setpointRpm           = 145.0;  // Target RPM default (setara zona normal)
float Kp                    = 1.35;   // Konstanta Proporsional (hasil tuning stabil)
float Ki                    = 1.15;   // Konstanta Integral (hasil tuning stabil)
float Kd                    = 0.08;   // Konstanta Derivatif (hasil tuning stabil)

float pidError        = 0.0;
float pidPrevError    = 0.0;
float pidIntegral     = 0.0;
int   actualPwmOutput = 180;    // Nilai PWM aktual yang dikirim ke L298N
unsigned long lastPidTime = 0;

// ==========================================
// 5. INTERRUPT OPTOCOUPLER
// ==========================================
void IRAM_ATTR onPulseDetected() {
  unsigned long now  = micros();
  unsigned long diff = now - lastPulseMicros;

  // Debounce 100.000 mikrodetik (100 ms) agar bebas noise motor DC
  if (diff > 100000) {
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

    currentRpm = 60000000.0 / (float)revTime;
  } else if (micros() - lastPulseMicros > 1500000) {
    currentRpm = 0.0;
  }
}

// ==========================================
// 6. KONTROL MOTOR DC (L298N MINI), PID & SERVO
// ==========================================
void terapkanKecepatanMotor(int pwm) {
  actualPwmOutput = constrain(pwm, 0, 255);
  ledcWrite(IN1, actualPwmOutput); // Pada ESP32 Core 3.x, ledcWrite menggunakan nomor PIN (IN1)
  digitalWrite(IN2, LOW);
}

void hitungDanTerapkanPid() {
  // Jika mode manual aktif, langsung gunakan targetSpeed mentah (perilaku lama)
  if (!pidEnabled) {
    pidError = setpointRpm - currentRpm;
    terapkanKecepatanMotor(targetSpeed);
    return;
  }

  unsigned long now = millis();
  if (now - lastPidTime < 100) return; // Sampling PID setiap 100 ms (10 Hz)

  float dt = (now - lastPidTime) / 1000.0;
  lastPidTime = now;

  if (setpointRpm <= 0.0) {
    pidError     = 0.0;
    pidPrevError = 0.0;
    pidIntegral  = 0.0;
    terapkanKecepatanMotor(0);
    return;
  }

  pidError = setpointRpm - currentRpm;

  // Integral dengan anti-windup agar PWM tidak jenuh
  pidIntegral += pidError * dt;
  pidIntegral = constrain(pidIntegral, -250.0, 250.0);

  // Derivatif
  float derivative = (pidError - pidPrevError) / dt;
  pidPrevError = pidError;

  // Koreksi PID
  float output = (Kp * pidError) + (Ki * pidIntegral) + (Kd * derivative);

  // Batasi minimum PWM agar motor tidak stall saat berputar, maksimum 255
  int pwmCmd = constrain((int)round(output), 85, 255);
  terapkanKecepatanMotor(pwmCmd);
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

  // Otomatis buka kunci box saat baru tiba di titik tujuan
  if (isArrived && !prevArrived && isBoxLocked) {
    putarBuka();
  }

  // Aturan Kecepatan Zona:
  // 1. Zona Sekolah selalu membatasi kecepatan maksimal 90 RPM (keselamatan prioritas)
  if (inSlowZone) {
    targetSpeed = 120;
    if (!manualSetpointOverride || setpointRpm > 90.0) {
      setpointRpm = 90.0;
    }
  }
  // 2. Di luar zona sekolah: ikuti aturan zona HANYA jika user tidak mengunci setpoint manual dari web
  else if (!manualSetpointOverride) {
    if (inTollZone) {
      targetSpeed = 255;
      setpointRpm = 195.0; // Target RPM zona tol/cepat
    } else {
      targetSpeed = 180;
      setpointRpm = 145.0; // Target RPM zona normal / tujuan
    }
  }

  // Jika mode manual (open-loop), langsung terapkan PWM seperti sebelumnya
  if (!pidEnabled) {
    terapkanKecepatanMotor(targetSpeed);
  }
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
    } else if (message == "RESET") {
      // Reset state perjalanan, kembalikan kendali zona otomatis & kunci kontainer
      isArrived              = false;
      inSlowZone             = false;
      inTollZone             = false;
      manualSetpointOverride = false;
      targetSpeed            = 180;
      setpointRpm            = 145.0;
      pidIntegral            = 0.0;
      pidPrevError           = 0.0;
      if (!isBoxLocked) {
        putarKunci();
      }
      Serial.println("[CMD] Trip di-reset! Status kedatangan & PID dibersihkan.");
    } else if (message.startsWith("SET_SPEED:")) {
      targetSpeed = constrain(message.substring(10).toInt(), 0, 255);
      setpointRpm = map(targetSpeed, 0, 255, 0, 195);
      manualSetpointOverride = true;
      if (!pidEnabled) {
        terapkanKecepatanMotor(targetSpeed);
      }
      Serial.print("[CMD] Target Speed diubah server ke: ");
      Serial.println(targetSpeed);
    } else if (message.startsWith("SET_RPM:")) {
      setpointRpm = constrain(message.substring(8).toFloat(), 0.0, 220.0);
      manualSetpointOverride = true;
      Serial.print("[CMD] Setpoint RPM manual dikunci ke: ");
      Serial.println(setpointRpm);
    } else if (message == "PID_MODE:AUTO") {
      pidEnabled   = true;
      pidIntegral  = 0.0;
      pidPrevError = 0.0;
      Serial.println("[PID] Mode AUTO (Closed-Loop) aktif");
    } else if (message == "PID_MODE:MANUAL") {
      pidEnabled = false;
      terapkanKecepatanMotor(targetSpeed);
      Serial.println("[PID] Mode MANUAL (Open-Loop) aktif");
    } else if (message.startsWith("SET_PID:")) {
      // Format: SET_PID:1.35,1.15,0.08
      String params = message.substring(8);
      int firstComma  = params.indexOf(',');
      int secondComma = params.indexOf(',', firstComma + 1);
      if (firstComma > 0 && secondComma > firstComma) {
        Kp = params.substring(0, firstComma).toFloat();
        Ki = params.substring(firstComma + 1, secondComma).toFloat();
        Kd = params.substring(secondComma + 1).toFloat();
        pidIntegral  = 0.0;
        pidPrevError = 0.0;
        Serial.printf("[PID] Parameter diperbarui -> Kp: %.2f, Ki: %.2f, Kd: %.2f\n", Kp, Ki, Kd);
      }
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

  // 1. Init Servo MG90S TANPA allocateTimer manual
  boxServo.setPeriodHertz(50);
  boxServo.attach(SERVO_PIN, 500, 2400);
  boxServo.write(0);
  isBoxLocked = true;

  // 2. Init Motor DC L298N Mini di Kanal 8 (terpisah jauh dari kanal 0-1 milik Servo)
  pinMode(IN2, OUTPUT);
  digitalWrite(IN2, LOW);
  ledcAttachChannel(IN1, MOTOR_PWM_FREQ, MOTOR_PWM_RES, MOTOR_PWM_CHANNEL);
  terapkanKecepatanMotor(targetSpeed);

  // 3. Init Optocoupler Interrupt (Pin 33)
  pinMode(OPTO_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(OPTO_PIN), onPulseDetected, RISING);

  // 4. Init GPS & DHT22
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  dht.begin();

  // 5. Init Jaringan
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(4096);
  client.setCallback(callback);

  lastPidTime = millis();
  Serial.println("Sistem Full Smart Logistic Tracker + PID Siap!");
}

// ==========================================
// 12. LOOP UTAMA
// ==========================================
void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  updateRpm();
  hitungDanTerapkanPid();

  if (gps.location.isUpdated() && gps.location.isValid()) {
    evaluasiZonaLokal(gps.location.lat(), gps.location.lng());
  }

  if (millis() - lastDhtTime >= 2000) {
    lastDhtTime = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHum  = h;
    }
  }

  if (millis() - lastMqttTime >= 1500) {
    lastMqttTime = millis();
    if (client.connected()) {
      StaticJsonDocument<768> doc;
      doc["lat"]          = gps.location.isValid() ? gps.location.lat() : 0.0;
      doc["lng"]          = gps.location.isValid() ? gps.location.lng() : 0.0;
      doc["satelit"]      = gps.satellites.value();
      doc["rpm"]          = round(currentRpm * 10.0) / 10.0;
      doc["setpoint_rpm"] = round(setpointRpm * 10.0) / 10.0;
      doc["pid_error"]    = round(pidError * 10.0) / 10.0;
      doc["pwm_out"]      = actualPwmOutput;
      doc["pid_mode"]     = pidEnabled ? "AUTO" : "MANUAL";
      doc["kp"]           = Kp;
      doc["ki"]           = Ki;
      doc["kd"]           = Kd;
      doc["temp"]         = currentTemp;
      doc["hum"]          = currentHum;
      doc["lock"]         = isBoxLocked ? "LOCKED" : "UNLOCKED";
      doc["target_speed"] = targetSpeed;
      doc["in_zone"]      = inSlowZone;
      doc["in_toll"]      = inTollZone;
      doc["arrived"]      = isArrived;

      char buffer[768];
      serializeJson(doc, buffer);
      client.publish(topic_pub, buffer);

      Serial.print("Data Terkirim: ");
      Serial.println(buffer);
    }
  }
}