# Sistem-Speed-Limiter-Geofence
```
Anggota Kelompok:
1. IBNU ABBAS (H1H024038)
2. ANDYKA ZEFANYA BRAMANTYO (H1H024039)
3. ARIFIN BUDI KUSUMA (H1H024040)
4. RAMANDHANU ISNAERA AHNAF WIBAWA (H1H024061)
```
## Dashboard Web (React + Laravel + Reverb)

Alur data (sesuai `firmware/main.cpp`):

```text
ESP32 --MQTT--> broker.emqx.io --> php artisan mqtt:listen --> MySQL
                                          |
                                          +--> event TelemetryUpdated --> Laravel Reverb --> React (Laravel Echo)
React --POST /api/command/lock|unlock--> Laravel --MQTT "LOCK"/"UNLOCK"--> ESP32
```

Topik MQTT: `unsoed/wokwi/esp32gpsTK24/sensor` (data) dan `unsoed/wokwi/esp32gpsTK24/command` (perintah teks `LOCK` / `UNLOCK`).

Payload sensor dari firmware (tiap 5 detik):

```json
{"lat":-7.425,"lng":109.229,"hum":60.0,"temp":28.5,"batt":90.0,"lock":"LOCKED","dist":45.0,"arrived":false,"rpm":120.0,"inZone":true}
```

### Menjalankan (Windows + Laragon)

Backend, satu kali:

```powershell
cd web/backend
composer install
composer require laravel/reverb      # jangan jalankan reverb:install, konfigurasinya sudah ada
copy .env.example .env
php artisan key:generate
# buat database "speed_limiter_geofence" di Laragon (MySQL)
php artisan migrate:fresh --seed
```

Jalankan di 4 terminal:

```powershell
cd web/backend;  php artisan serve          # API di http://localhost:8000
cd web/backend;  php artisan reverb:start   # WebSocket di port 8080
cd web/backend;  php artisan mqtt:listen    # menerima data ESP32
cd web/frontend; npm install; npm run dev   # dashboard di http://localhost:5173
```

Uji tanpa perangkat (jalur HTTP `/api/gsm`, tetap tampil di dashboard lewat Reverb):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/gsm -ContentType 'application/json' -Body '{"lat":-7.42500,"lng":109.22900,"hum":60,"temp":28.5,"batt":90,"lock":"LOCKED","dist":45,"arrived":false,"rpm":100,"inZone":true}'
```

Nilai `REVERB_*` di `web/backend/.env` harus sama dengan `VITE_REVERB_*` di `web/frontend/.env`.

### Endpoint API

| Method | URL | Fungsi |
|---|---|---|
| GET | `/api/telemetries?limit=60` | riwayat telemetri dan data terakhir |
| GET | `/api/geofences` | zona dari database (seeder: zona lambat dan tujuan) |
| GET | `/api/activities` | 30 aktivitas terakhir |
| POST | `/api/command/lock` · `/api/command/unlock` | kirim perintah ke ESP32 lewat MQTT |
| POST | `/api/gsm` | jalur cadangan HTTP (SIM800L), format sama dengan payload MQTT |

### Catatan

- Firmware tidak mengirim kecepatan km/jam; yang diukur adalah RPM motor, jadi dashboard menampilkan RPM dan target RPM per zona (100 di zona lambat, 255 di luar zona).
- Nilai `batt` dari firmware bersifat simulasi (turun 0,5 tiap kirim), bukan pengukuran baterai.
- Broker `broker.emqx.io` bersifat publik: siapa pun yang tahu nama topik bisa mengirim data atau perintah. Untuk uji coba tidak masalah, untuk produksi gunakan broker pribadi dengan autentikasi.
- Tombol Buka hanya aktif setelah `arrived = true`, sesuai aturan firmware (UNLOCK ditolak sebelum tiba di tujuan, radius 20 m).
