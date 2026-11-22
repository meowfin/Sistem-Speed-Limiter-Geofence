import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import useEcho from './useEcho';

const MAX = 60;

export default function useTelemetry() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [error, setError] = useState(null);
  const prev = useRef(null);

  const refreshActivities = useCallback(
    () => api.getActivities().then((r) => setActivities(r.data.data)).catch(() => {}),
    [],
  );

  // Fungsi untuk membersihkan grafik, jejak rute, dan status saat sesi di-reset
  const clearSessionState = useCallback((newSession = '') => {
    setHistory([]);
    setLatest((curr) =>
      curr
        ? {
            ...curr,
            rpm: 0,
            setpoint_rpm: 145,
            pid_error: 0,
            pwm_out: 0,
            speed: 0,
            speed_mps: 0,
            speed_kmh: 0,
            arrived: false,
            in_zone: false,
            lock: 'LOCKED',
          }
        : null,
    );
    prev.current = null;
    if (newSession) setActiveSession(newSession);
    refreshActivities();
  }, [refreshActivities]);

  useEffect(() => {
    api.getTelemetries(MAX)
      .then((r) => {
        setHistory(r.data.data || []);
        setLatest(r.data.latest || null);
        if (r.data.session) setActiveSession(r.data.session);
        prev.current = r.data.latest || null;
      })
      .catch(() => setError('Backend tidak dapat dihubungi. Pastikan "php artisan serve" berjalan.'));
    api.getGeofences().then((r) => setGeofences(r.data.data)).catch(() => {});
    refreshActivities();
  }, [refreshActivities]);

  const connection = useEcho(
    useCallback((d) => {
      setLatest(d);
      if (d.trip_session) setActiveSession(d.trip_session);
      setHistory((h) => [...h.slice(-(MAX - 1)), d]);
      setError(null);
      const p = prev.current;
      prev.current = d;
      if (!p || p.in_zone !== d.in_zone || p.arrived !== d.arrived || p.lock !== d.lock) refreshActivities();
    }, [refreshActivities]),
    useCallback((resetPayload) => {
      clearSessionState(resetPayload?.newSession || '');
    }, [clearSessionState]),
  );

  return {
    latest,
    history,
    activities,
    geofences,
    activeSession,
    connection,
    error,
    refreshActivities,
    clearSessionState,
  };
}