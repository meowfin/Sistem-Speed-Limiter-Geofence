# 🚚 Smart Logistics Tracker and Speed Limiter
```
Anggota Kelompok:
1. IBNU ABBAS (H1H024038)
2. ANDYKA ZEFANYA BRAMANTYO (H1H024039)
3. ARIFIN BUDI KUSUMA (H1H024040)
4. RAMANDHANU ISNAERA AHNAF WIBAWA (H1H024061)
```

![Platform](https://img.shields.io/badge/Hardware-ESP32_DevKit_V1-blue?style=flat-square&logo=espressif)
![Firmware](https://img.shields.io/badge/Firmware-Arduino_C++-00979D?style=flat-square&logo=arduino)
![Backend](https://img.shields.io/badge/Backend-Laravel_&_Reverb-FF2D20?style=flat-square&logo=laravel)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react)
![Protocol](https://img.shields.io/badge/Protocol-MQTT_&_WebSocket-660066?style=flat-square&logo=eclipse-mosquitto)

Prototipe sistem pemantauan logistik rantai dingin (*cold-chain*), pembatas kecepatan kendaraan otomatis berbasis *geofencing*, kendali putaran motor *closed-loop* PID, penguncian boks kargo otomatis, serta verifikasi paket QR Code berbasis *Internet of Things* (IoT).

---

## 📋 Daftar Isi
1. [Latar Belakang & Tujuan](#-latar-belakang--tujuan)
2. [Fitur Utama](#-fitur-utama)
3. [Arsitektur Sistem](#-arsitektur-sistem)
4. [Spesifikasi Perangkat Keras & Datasheet](#-spesifikasi-perangkat-keras--datasheet)
5. [Pemetaan Pin (Pinout Mapping)](#-pemetaan-pin-pinout-mapping)
6. [Formulasi Matematis & Algoritma Kendali](#-formulasi-matematis--algoritma-kendali)
7. [Protokol Komunikasi MQTT](#-protokol-komunikasi-mqtt)
8. [Struktur Direktori Repositori](#-struktur-direktori-repositori)
9. [Dependensi & Pustaka Perangkat Lunak](#-dependensi--pustaka-perangkat-lunak)
10. [Panduan Instalasi & Pengujian](#-panduan-instalasi--pengujian)
11. [Referensi & Datasheet](#-referensi--datasheet)

---

## 🎯 Latar Belakang & Tujuan

Distribusi logistik sensitif suhu (*cold-chain*) kerap menghadapi tiga kendala operasional utama: fluktuasi suhu ruang kargo yang tidak terpantau, pelanggaran batas kecepatan di kawasan rawan (seperti zona sekolah) akibat kendali motor *open-loop*, serta risiko pembukaan paksa kompartemen muatan sebelum tiba di lokasi tujuan.

Sistem ini dirancang untuk mengatasi permasalahan tersebut melalui:
* **Pemantauan Telemetri Lingkungan:** Akuisisi suhu dan kelembapan ruang kargo secara berkala menggunakan sensor DHT22.
* **Pembatas Kecepatan Adaptif (*Hybrid Edge-Cloud Geofencing*):** Kalkulasi jarak Haversine langsung pada ESP32 untuk menurunkan batas kecepatan di zona sekolah, menyesuaikan laju di zona tol/bebas, serta membuka kunci boks secara otomatis saat tiba di titik tujuan.
* **Stabilisasi Kecepatan *Closed-Loop* PID:** Pengaturan sinyal PWM motor DC berbasis umpan balik putaran roda dari sensor optocoupler agar laju kendaraan tetap stabil mengikuti *setpoint*.
* **Keamanan Kargo & Validasi Serah Terima QR Code:** Integrasi aktuator kunci servo MG90S dengan generator label stiker QR Code dan pemindai kamera *smartphone* pada dasbor web *real-time*.

---

## ✨ Fitur Utama

* **Real-Time Telemetry & WebSocket Streaming:** Pengiriman data koordinat GPS, jumlah satelit, suhu, kelembapan, RPM aktual, *setpoint* RPM, keluaran PWM, kecepatan linear (km/jam dan m/s), serta status kunci melalui protokol MQTT dan Laravel Reverb tanpa *reload* halaman.
* **Haversine Geofencing Automation:** Mendukung pemetaan berbagai zona virtual pada peta interaktif (*Zona Bebas*, *Zona Lambat / Sekolah*, *Zona Tol*, dan *Zona Tujuan*) dengan eksekusi aturan kecepatan dan pembukaan kunci otomatis di sisi *edge*.
* **Digital PID Motor Controller:** Kendali tertutup (Kp, Ki, Kd) dengan periode sampling 100 ms, peredaman derau *software debounce* pada *interrupt* optocoupler, sakelar mode *Auto (PID) / Manual (Open-Loop)*, serta konversi target kecepatan dari km/jam dan m/s ke RPM.
* **Smart Cargo Lock & SCM QR Verification:** Cetak label QR Code paket, pemindaian verifikasi barang via kamera HP (mendukung HTTPS *Cloudflare Tunnel*), deteksi duplikasi *scan*, dan pencatatan riwayat aktivitas (*Activity Log*).
* **Trip Session Management & CSV Export:** Pemisahan dataset berdasarkan sesi perjalanan (`trip_session`), tombol *Reset Perjalanan* yang menyinkronkan perangkat keras dan grafik secara serentak, serta ekspor data ke format `.csv`.

---

## 🏗️ Arsitektur Sistem

```text
+-------------------------------------------------------------------+
|                     CATU DAYA (POWER SUPPLY)                      |
|  2x Baterai Li-ion 3,7V Seri (7,4V) ---> Regulator Step-Down 5V   |
+---------------------------------+---------------------------------+
                                  | (5V & Common GND)
                                  v
+-----------------------+   +---------------------------------------+
|   LAPISAN SENSOR      |   |       MIKROKONTROLER UTAMA            |
|                       |   |          ESP32 DevKit V1              |
| - GPS u-blox NEO-6M --+-->| UART2 (GPIO 16, 17)                   |
| - Sensor DHT22 -------+-->| Single-Wire (GPIO 4)                  |
| - Optocoupler IR -----+-->| External Interrupt (GPIO 27)          |
+-----------------------+   +---+---------------+-------------------+
                                |               |
               PWM (GPIO 25,26) |               | PWM (GPIO 13)
                                v               v
                    +-----------------+   +---------------+
                    | Driver L298N    |   | Servo MG90S   |
                    | Mini + Motor DC |   | (Kunci Boks)  |
                    +-----------------+   +---------------+
                                                ^
                                                | Wi-Fi (MQTT Pub/Sub)
                                                v
                    +-----------------------------------------------+
                    |         BROKER MQTT & SERVER APLIKASI         |
                    |   broker.emqx.io  <--->  Laravel + Reverb     |
                    +---------------------------+-------------------+
                                                | WebSocket & HTTPS
                                                v
                    +-----------------------------------------------+
                    |       DASBOR WEB REACT & SCANNER KAMERA       |
                    |  Peta Geofence, Grafik PID, QR Code, CSV Log  |
                    +-----------------------------------------------+
```

---

## 🔧 Spesifikasi Perangkat Keras & Datasheet

Seluruh rangkaian elektronik disolder di atas **PCB lubang (*dot matrix*)** dan dipasang pada prototipe bodi kendaraan serta boks kargo berbahan **karton tebal (*board*)**.

| No | Komponen | Parameter & Spesifikasi Datasheet | Fungsi dalam Sistem |
| :-- | :--- | :--- | :--- |
| 1 | **ESP32 DevKit V1** | Dual-Core Xtensa LX6, Wi-Fi 2,4 GHz IEEE 802.11 b/g/n, Logika GPIO 3,3 V, 30 Pin | Unit pemroses utama, kalkulasi Haversine & PID, serta klien MQTT |
| 2 | **GPS u-blox NEO-6M** | 50 Kanal, Antarmuka UART (9600 bps), Tegangan 3,3 V – 5 V, Akurasi rata-rata ±6,48 m | Akuisisi koordinat geografis (*latitude* & *longitude*) |
| 3 | **Sensor DHT22** | Rentang Suhu -40°C s.d. 80°C (±0,5°C), Kelembapan 0–100% RH (±2% RH) | Pemantauan suhu dan kelembapan ruang kargo |
| 4 | **Optocoupler IR** | *Slotted Optical Speed Sensor* (LM393), Output Digital (DO), Tegangan 3,3 V – 5 V | Pembacaan pulsa putaran cakram encoder untuk menghitung RPM |
| 5 | **Driver L298N Mini** | Dual H-Bridge, Tegangan Motor 2 V – 10 V, Arus Kontinu 1,5 A/kanal | Pengendali arah dan kecepatan motor DC via sinyal PWM |
| 6 | **Motor DC Gearbox** | Tegangan 3 V – 6 V, Rasio Gearbox 1:48, Diameter Roda 6,5 cm | Aktuator penggerak roda kendaraan logistik |
| 7 | **Motor Servo MG90S** | *Micro Servo Metal Gear*, Torsi 2,0 kg·cm, Sudut 0°–180°, Tegangan 4,8 V – 6 V | Mekanisme pengunci pintu boks kargo otomatis |
| 8 | **Sistem Catu Daya** | 2x Baterai Li-ion 3,7 V Seri (7,4 V nominal) + Regulator *Step-Down* 5 V | Sumber daya utama papan mikrokontroler dan aktuator |

---

## 🔌 Pemetaan Pin (*Pinout Mapping*)

> **Catatan Keselamatan Rangkaian:** Seluruh jalur negatif (`GND`) dari baterai, regulator 5 V, ESP32, sensor, dan aktuator **wajib dihubungkan bersama (*Common Ground*)**. Suplai daya motor DC dan servo diambil langsung dari keluaran regulator 5 V, bukan dari pin `3V3` ESP32.

| Modul / Komponen | Pin Komponen | Terhubung ke Pin ESP32 / Daya | Keterangan Antarmuka |
| :--- | :--- | :--- | :--- |
| **Regulator Step-Down 5V** | `OUT+` / `OUT-` | `VIN` ESP32 / `GND` Bersama | Suplai daya utama 5 V DC |
| **GPS u-blox NEO-6M** | `VCC` / `GND` | `3V3` / `GND` | Catu daya modul GPS |
| | `TX` | `GPIO 16` (`RX2`) | Penerima data serial NMEA (UART2) |
| | `RX` | `GPIO 17` (`TX2`) | Pengirim konfigurasi serial (UART2) |
| **Sensor DHT22** | `VCC` / `GND` | `3V3` / `GND` | Catu daya sensor suhu & kelembapan |
| | `DATA` | `GPIO 4` | Pembacaan sinyal digital *single-wire* |
| **Optocoupler IR** | `VCC` / `GND` | `3V3` / `GND` | Catu daya sensor kecepatan |
| | `DO` | `GPIO 27` | *Hardware Interrupt* (`RISING`) penghitung pulsa RPM |
| **Driver L298N Mini** | `+` / `-` | `5V` Regulator / `GND` | Catu daya penggerak motor DC |
| | `IN1` | `GPIO 25` | Sinyal PWM kendali maju (Kanal Timer terpisah) |
| | `IN2` | `GPIO 26` | Sinyal PWM kendali mundur / pengereman |
| **Motor Servo MG90S** | Merah (`VCC`) | `5V` Regulator | Catu daya aktuator servo |
| | Cokelat (`GND`) | `GND` | *Common Ground* |
| | Oranye (`PWM`) | `GPIO 13` | Sinyal PWM pengaturan sudut (0° kunci / 90° buka) |

---

## 📐 Formulasi Matematis & Algoritma Kendali

### 1. Perhitungan Jarak *Geofencing* (Formula Haversine)
Untuk menentukan jarak aktual kendaraan (φ₁, λ₁) terhadap titik pusat zona (φ₂, λ₂) pada permukaan bumi dengan jari-jari R = 6.371.000 meter:

```text
a = sin²(Δφ / 2) + cos(φ₁) · cos(φ₂) · sin²(Δλ / 2)
d = 2R · atan2(√a, √(1 − a))
```

Jika nilai `d ≤ R_zona`, mikrokontroler mengeksekusi aturan pembatasan kecepatan zona khusus atau memicu pembukaan kunci servo secara otomatis.

### 2. Pengukuran Kecepatan Putar (RPM) & Kecepatan Linear
Kecepatan putar poros dihitung dari selisih waktu antar pulsa interupsi (Δt dalam satuan mikrodetik):

```text
RPM = (60 × 10⁶) / Δt_μs
```

Dengan diameter roda D = 6,5 cm (0,065 m), kecepatan linear kendaraan dikonversi menjadi:

```text
v (m/s)    = (RPM × π × D) / 60
v (km/jam) = v (m/s) × 3,6
```

### 3. Kendali Kecepatan *Closed-Loop* PID
Sinyal kendali PWM `u(t)` dihitung secara diskrit setiap interval pencuplikan Δt = 0,1 detik berdasarkan galat `e(t) = Setpoint_RPM − Actual_RPM`:

```text
u(t) = Kp · e(t) + Ki · ∑ e(t)Δt + Kd · (e(t) − e(t − 1)) / Δt
```

---

## 📡 Protokol Komunikasi MQTT

Sistem menggunakan arsitektur *publish-subscribe* melalui broker MQTT (`broker.emqx.io`, port `1883`) untuk pertukaran data telemetri dan perintah kendali jarak jauh.

| Arah | Topik MQTT | Format Payload | Keterangan |
| :--- | :--- | :--- | :--- |
| **ESP32 → Web** | `unsoed/wokwi/esp32gpsTK24/sensor` | JSON | Mengirim data GPS, satelit, RPM, *setpoint*, galat PID, PWM, suhu, kelembapan, zona, dan status kunci |
| **Web → ESP32** | `unsoed/wokwi/esp32gpsTK24/command` | String / JSON | Perintah kendali jarak jauh (`LOCK`, `UNLOCK`, `SET_PID`, `PID_MODE`, `SET_RPM`, `RESET`) |
| **Web → ESP32** | `unsoed/wokwi/esp32gpsTK24/zones` | JSON (*Retained*) | Sinkronisasi koordinat dan radius zona *geofence* ke memori ESP32 |

**Contoh Payload Telemetri (`unsoed/wokwi/esp32gpsTK24/sensor`):**
```json
{
  "lat": -7.429812,
  "lng": 109.338210,
  "satelit": 8,
  "rpm": 144.2,
  "setpoint_rpm": 145.0,
  "pid_error": 0.8,
  "pwm_out": 178,
  "kp": 1.1,
  "ki": 0.45,
  "kd": 0.05,
  "pid_mode": "AUTO",
  "temp": 25.4,
  "hum": 64.0,
  "zone": "Zona Bebas",
  "lock": "LOCKED"
}
```

---

## 📁 Struktur Direktori Repositori

```text
smart-logistics-tracker/
├── firmware/                  # Kode sumber ESP32 (Arduino C++)
├── web/
│   ├── backend/               # REST API, MQTT Listener, Database & Laravel Reverb
│   └── frontend/              # Dashboard React (Peta Geofence, Grafik PID, QR Scanner)
└── README.md                  # Dokumentasi proyek
```

---

## 💻 Dependensi & Pustaka Perangkat Lunak

### Firmware ESP32 (Arduino IDE / PlatformIO)
* `TinyGPSPlus` — Parsing data NMEA dari modul GPS u-blox NEO-6M.
* `DHT sensor library` (Adafruit) — Pembacaan data suhu dan kelembapan sensor DHT22.
* `PubSubClient` — Klien komunikasi protokol MQTT.
* `ESP32Servo` — Pembangkit sinyal PWM presisi untuk motor servo pada arsitektur timer ESP32.
* `ArduinoJson` — Serialisasi dan deserialisasi payload JSON.

### Aplikasi Web (Backend & Frontend)
* **Laravel & Laravel Reverb:** Pengelolaan basis data MySQL, *worker* MQTT (`mqtt:listen`), ekspor dataset CSV, verifikasi QR Code paket, dan siaran WebSocket *real-time*.
* **React, Tailwind CSS, Leaflet, `qrcode.react`, & `html5-qrcode`:** Antarmuka pengguna interaktif bertema *Dark Midnight Blue*, peta *geofence* gelap, panel *tuning* PID, serta cetak dan pindai QR Code.

---

## 🚀 Panduan Instalasi & Pengujian

### 1. Konfigurasi Firmware ESP32
1. Buka berkas kode sumber pada direktori `firmware/` menggunakan **Arduino IDE**.
2. Instal seluruh pustaka yang tercantum pada bagian [Dependensi Perangkat Lunak](#-dependensi--pustaka-perangkat-lunak) melalui *Library Manager*.
3. Sesuaikan kredensial Wi-Fi dan broker MQTT pada bagian konfigurasi:
   ```cpp
   const char* ssid        = "<NAMA_WIFI>";
   const char* password    = "<PASSWORD_WIFI>";
   const char* mqtt_server = "broker.emqx.io";
   ```
4. Pilih board **DOIT ESP32 DEVKIT V1**, pilih *Port* yang sesuai, lalu klik **Upload**.

### 2. Menjalankan Aplikasi Web Dashboard
1. Masuk ke direktori `web/backend` dan instal dependensi PHP:
   ```bash
   composer install
   cp .env.example .env
   php artisan key:generate
   php artisan migrate
   ```
2. Masuk ke direktori `web/frontend`, instal dependensi Node.js, dan bangun bundel produksi ke direktori publik Laravel:
   ```bash
   npm install
   npm run build
   ```
3. Jalankan layanan backend, *listener* MQTT, dan server WebSocket Reverb secara bersamaan:
   ```bash
   php artisan serve
   php artisan mqtt:listen
   php artisan reverb:start
   ```
4. *(Opsional untuk pengujian lapangan via Smartphone)* Jalankan *Cloudflare Tunnel* HTTPS agar fitur kamera pemindai QR Code dapat diakses melalui peramban seluler.

---

## 📚 Referensi & Datasheet

### Datasheet Resmi Komponen
* Espressif Systems, *ESP32-WROOM-32 Datasheet*, v3.4.
* u-blox AG, *NEO-6 u-blox 6 GPS Modules Data Sheet*, Doc. No. GPS.G6-HW-09005.
* Aosong Electronics, *Digital-output relative humidity & temperature sensor/module DHT22 (AM2302) Datasheet*.
* STMicroelectronics, *L298 Dual Full-Bridge Driver Datasheet*.

### Pustaka Ilmiah (Format IEEE)
1. T. O. Priyono and Sumardi, "Monitoring dan Pengendalian Beban Listrik Berbasis Internet of Things (IoT) Menggunakan ESP32," *Jurnal Elektro*, vol. 11, no. 1, pp. 57–68, Feb. 2023.
2. J. Andreas, M. Fathurahman, and B. Utami, "Analisis Tingkat Akurasi NEO-6M dengan Google Maps," *SNIV: Seminar Nasional Inovasi Vokasi*, vol. 4, no. 1, pp. 1018–1023, Jun. 2025.
3. A. Abrar, S. Akbar, and Tukino, "Rancang Bangun Sistem Kontrol Motor Listrik Berbasis Raspberry Pi," *Jurnal Ilmiah Informatika*, vol. 11, no. 1, pp. 48–53, Mar. 2023.
4. M. Amin, R. Ananda, and J. Eska, "Analisis Penggunaan Driver Mini Victor L298N terhadap Mobil Robot dengan Dua Perintah Android dan Arduino Nano," *JURTEKSI (Jurnal Teknologi dan Sistem Informasi)*, vol. 6, no. 1, pp. 51–58, Dec. 2019.
5. A. Marzuqi, A. Halim, and Rudianto, "Rancang Bangun Lengan Robot 6-DOF Berbasis Wemos ESP32 D1 R32," *JATI (Jurnal Mahasiswa Teknik Informatika)*, vol. 9, no. 5, pp. 9207–9211, Oct. 2025.
6. R. L. E. Putri and N. Akhiriyanto, "Monitoring Kecepatan Putar Motor Reluktansi Menggunakan Data Streamer," *INHARDWARE: Journal of Instrumentation and Hardware*, vol. 2, no. 2, pp. 20–28, Dec. 2024.
7. F. Saputra, D. R. Suchendra, and M. I. Sani, "Implementasi Sistem Sensor DHT22 untuk Menstabilkan Suhu dan Kelembapan Berbasis Mikrokontroller NodeMCU ESP8266 pada Ruangan," *e-Proceeding of Applied Science*, vol. 6, no. 2, pp. 1977–1984, Aug. 2020.
8. B. R. Faishal, H. E. Wahanani, and R. Mumpuni, "Implementation of IoT-Based PID Control System for Bioactive Vivarium," *DE FACTO: Journal of International Multidisciplinary Science*, vol. 4, no. 1, pp. 155–167, Feb. 2026.
9. D. F. Putri and D. Widhiantoro, "Implementasi Metode Geofencing untuk Sistem Pelacak Lokasi: Studi Literatur Sistematis," *SNIV: Seminar Nasional Inovasi Vokasi*, vol. 4, no. 1, pp. 785–791, Jun. 2025.
10. F. A. Fauzi, M. K. Delimayanti, and V. Frendiana, "Analisis Implementasi Protokol MQTT dan HTTP pada Sistem Monitoring Berbasis IoT," *SNIV: Seminar Nasional Inovasi Vokasi*, vol. 5, no. 1, pp. 197–205, Jun. 2026.
