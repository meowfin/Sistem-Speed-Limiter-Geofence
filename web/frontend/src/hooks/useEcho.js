import { useEffect, useRef, useState } from 'react';
import echo from '../services/echo';

// Berlangganan channel publik "telemetry" (event .telemetry.updated & .trip.reset)
export default function useEcho(onTelemetry, onTripReset) {
  const [state, setState] = useState('connecting');
  const cb = useRef(onTelemetry);
  const resetCb = useRef(onTripReset);
  cb.current = onTelemetry;
  resetCb.current = onTripReset;

  useEffect(() => {
    const conn = echo.connector.pusher.connection;
    const onState = ({ current }) => setState(current);
    setState(conn.state);
    conn.bind('state_change', onState);

    echo.channel('telemetry')
      .listen('.telemetry.updated', (e) => cb.current(e.data))
      .listen('.trip.reset', (e) => {
        if (resetCb.current) resetCb.current(e);
      });

    return () => {
      conn.unbind('state_change', onState);
      echo.leave('telemetry');
    };
  }, []);

  return state;
}