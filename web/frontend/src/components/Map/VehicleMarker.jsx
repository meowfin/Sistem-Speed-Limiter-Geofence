import { useEffect } from 'react';
import L from 'leaflet';
import { Marker, Tooltip, useMap } from 'react-leaflet';

// divIcon dipakai agar tidak bergantung pada file ikon bawaan Leaflet yang sering rusak di Vite
const icon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function VehicleMarker({ latest }) {
  const map = useMap();
  const pos = [Number(latest.latitude), Number(latest.longitude)];

  useEffect(() => {
    if (!map.getBounds().contains(pos)) map.panTo(pos);
  }, [latest.latitude, latest.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Marker position={pos} icon={icon}>
      <Tooltip>{latest.vehicle_id}</Tooltip>
    </Marker>
  );
}
