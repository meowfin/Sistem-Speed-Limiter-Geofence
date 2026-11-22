import { useState } from 'react';
import { Circle, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { geofenceColor } from '../../utils/geofenceUtils';

export default function GeofenceCircle({ g }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  // Pantau perubahan zoom peta agar lebar buffer polyline selalu akurat dalam meter
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  const color =
    g.zone_category === 'toll'
      ? '#8b5cf6'
      : g.zone_category === 'destination'
      ? '#10b981'
      : geofenceColor(g.name);

  // 1. Jika tipe zona adalah Jalur Panjang (Polyline / Jalan Tol)
  if (g.type === 'polyline' && Array.isArray(g.path_points) && g.path_points.length >= 2) {
    const positions = g.path_points.map((pt) => [Number(pt.lat), Number(pt.lng)]);
    const centerLat = positions[0][0];

    // Hitung berapa meter per 1 pixel pada level zoom saat ini
    const metersPerPixel =
      (156543.03392 * Math.cos((centerLat * Math.PI) / 180)) / Math.pow(2, zoom);

    // Total lebar garis = diameter (2 * radius_meters) dikonversi ke pixel
    const bufferWeightPx = Math.max(8, ((Number(g.radius_meters) * 2) / metersPerPixel));

    return (
      <>
        {/* Layer luar transparan sesuai radius_meters asli di bumi */}
        <Polyline
          positions={positions}
          pathOptions={{
            color,
            weight: bufferWeightPx,
            opacity: 0.25,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        {/* Garis tengah rute jalan tol */}
        <Polyline
          positions={positions}
          pathOptions={{ color, weight: 3, opacity: 0.9, dashArray: '8, 6' }}
        >
          <Tooltip sticky>{g.name} · Buffer ±{g.radius_meters} m</Tooltip>
        </Polyline>
      </>
    );
  }

  // 2. Jika tipe zona adalah Titik (Circle / Sekolah & Tujuan)
  if (g.center_lat == null || g.center_lng == null) return null;

  return (
    <Circle
      center={[Number(g.center_lat), Number(g.center_lng)]}
      radius={Number(g.radius_meters)}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.2 }}
    >
      <Tooltip>{g.name} · {g.radius_meters} m</Tooltip>
    </Circle>
  );
}