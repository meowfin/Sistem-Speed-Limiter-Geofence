import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import GeofenceCircle from './GeofenceCircle';
import VehicleMarker from './VehicleMarker';
import { hasFix } from '../../utils/geofenceUtils';

const DEFAULT_CENTER = [-7.4249, 109.2293];

export default function MapView({ latest, geofences, trail }) {
  const g0 = geofences[0];
  const center = hasFix(latest)
    ? [Number(latest.latitude), Number(latest.longitude)]
    : g0 ? [Number(g0.center_lat), Number(g0.center_lng)] : DEFAULT_CENTER;
  const points = trail.filter(hasFix).map((p) => [Number(p.latitude), Number(p.longitude)]);

  return (
    <MapContainer center={center} zoom={18} scrollWheelZoom className="h-96 w-full rounded-xl">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {geofences.map((g) => <GeofenceCircle key={g.id} g={g} />)}
      {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#2563eb', weight: 3 }} />}
      {hasFix(latest) && <VehicleMarker latest={latest} />}
    </MapContainer>
  );
}
