import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_URL || '';

const http = axios.create({
  baseURL: baseUrl + '/api',
  timeout: 8000,
  headers: { Accept: 'application/json' },
});

export default {
  // Telemetri & Peta
  getTelemetries: (limit = 60) => http.get('/telemetries', { params: { limit } }),
  getGeofences: () => http.get('/geofences'),
  getActivities: () => http.get('/activities'),

  // Riwayat Sesi & Export CSV Riset
  getTripSessions: () => http.get('/telemetries/sessions'),
  getExportCsvUrl: (session = '') =>
    `${baseUrl}/api/telemetries/export-csv${session ? `?session=${encodeURIComponent(session)}` : ''}`,

  // Perintah Servo, Reset Sesi, & Kontrol PID
  lock: () => http.post('/command/lock'),
  unlock: () => http.post('/command/unlock'),
  resetTrip: () => http.post('/command/reset'),
  setPidConfig: (payload) => http.post('/command/pid', payload), // { kp, ki, kd, setpoint_rpm }
  setPidMode: (mode) => http.post('/command/pid-mode', { mode }), // 'AUTO' | 'MANUAL'

  // SCM QR Code (Paket Barang)
  getPackages: () => http.get('/packages'),
  createPackage: (payload) => http.post('/packages', payload), // { item_name, destination_name }
  verifyPackageScan: (packageCode) => http.post('/packages/verify-scan', { package_code: packageCode }),
  deletePackage: (id) => http.delete(`/packages/${id}`),
};