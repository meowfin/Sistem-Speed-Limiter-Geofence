import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import GeofenceCircle from './GeofenceCircle';
import VehicleMarker from './VehicleMarker';
import { hasFix } from '../../utils/geofenceUtils';

const DEFAULT_CENTER = [-7.4105, 109.3450]; // Area tengah Purbalingga (Kalimanah - Bung Karno)

export default function MapView({ latest, geofences, trail }) {
  const g0 = geofences[0];

  const getInitialCenter = () => {
    if (hasFix(latest)) {
      return [Number(latest.latitude), Number(latest.longitude)];
    }
    if (g0) {
      if (g0.type === 'polyline' && g0.path_points?.length > 0) {
        return [Number(g0.path_points[0].lat), Number(g0.path_points[0].lng)];
      }
      if (g0.center_lat != null && g0.center_lng != null) {
        return [Number(g0.center_lat), Number(g0.center_lng)];
      }
    }
    return DEFAULT_CENTER;
  };

  const points = trail.filter(hasFix).map((p) => [Number(p.latitude), Number(p.longitude)]);

  return (
    <MapContainer center={getInitialCenter()} zoom={14} scrollWheelZoom className="h-96 w-full rounded-xl">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {geofences.map((g) => (
        <GeofenceCircle key={g.id} g={g} />
      ))}
      {points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: '#2563eb', weight: 4 }} />
      )}
      {hasFix(latest) && <VehicleMarker latest={latest} />}
    </MapContainer>
  );
}