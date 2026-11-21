// Jarak dua titik (meter), rumus Haversine, sama dengan TinyGPSPlus::distanceBetween di firmware
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Firmware mengirim lat/lng = 0 saat GPS belum fix
export const hasFix = (t) => !!t && !(Number(t.latitude) === 0 && Number(t.longitude) === 0);

export const geofenceColor = (name = '') => (/tujuan|unlock/i.test(name) ? '#16a34a' : '#ea580c');

// Target RPM firmware: zona lambat 100, bebas 255 (RPM_ZONA_LAMBAT / RPM_BEBAS)
export const targetRpm = (inZone) => (inZone ? 100 : 255);

export default { haversine, hasFix, geofenceColor, targetRpm };
