import { useEffect, useRef, useState } from 'react';
import echo from '../services/echo';

// Berlangganan channel publik "telemetry" (event TelemetryUpdated) dan melaporkan status koneksi Reverb
export default function useEcho(onTelemetry) {
  const [state, setState] = useState('connecting');
  const cb = useRef(onTelemetry);
  cb.current = onTelemetry;

  useEffect(() => {
    const conn = echo.connector.pusher.connection;
    const onState = ({ current }) => setState(current);
    setState(conn.state);
    conn.bind('state_change', onState);
    echo.channel('telemetry').listen('.telemetry.updated', (e) => cb.current(e.data));

    return () => {
      conn.unbind('state_change', onState);
      echo.leave('telemetry');
    };
  }, []);

  return state;
}
