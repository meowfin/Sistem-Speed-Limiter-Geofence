import { Circle, Tooltip } from 'react-leaflet';
import { geofenceColor } from '../../utils/geofenceUtils';

export default function GeofenceCircle({ g }) {
  const color = geofenceColor(g.name);
  return (
    <Circle
      center={[Number(g.center_lat), Number(g.center_lng)]}
      radius={Number(g.radius_meters)}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.15 }}
    >
      <Tooltip>{g.name} · {g.radius_meters} m</Tooltip>
    </Circle>
  );
}
