import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 8000,
  headers: { Accept: 'application/json' },
});

export default {
  getTelemetries: (limit = 60) => http.get('/telemetries', { params: { limit } }),
  getGeofences: () => http.get('/geofences'),
  getActivities: () => http.get('/activities'),
  lock: () => http.post('/command/lock'),
  unlock: () => http.post('/command/unlock'),
};
