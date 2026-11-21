import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import useEcho from './useEcho';

const MAX = 60;

export default function useTelemetry() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [error, setError] = useState(null);
  const prev = useRef(null);

  const refreshActivities = useCallback(
    () => api.getActivities().then((r) => setActivities(r.data.data)).catch(() => {}),
    [],
  );

  useEffect(() => {
    api.getTelemetries(MAX)
      .then((r) => { setHistory(r.data.data); setLatest(r.data.latest); prev.current = r.data.latest; })
      .catch(() => setError('Backend tidak dapat dihubungi. Pastikan "php artisan serve" berjalan.'));
    api.getGeofences().then((r) => setGeofences(r.data.data)).catch(() => {});
    refreshActivities();
  }, [refreshActivities]);

  const connection = useEcho(
    useCallback((d) => {
      setLatest(d);
      setHistory((h) => [...h.slice(-(MAX - 1)), d]);
      setError(null);
      const p = prev.current;
      prev.current = d;
      if (!p || p.in_zone !== d.in_zone || p.arrived !== d.arrived || p.lock !== d.lock) refreshActivities();
    }, [refreshActivities]),
  );

  return { latest, history, activities, geofences, connection, error, refreshActivities };
}
