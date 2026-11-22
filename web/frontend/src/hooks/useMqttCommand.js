import { useState } from 'react';
import api from '../services/api';

export default function useMqttCommand(onDone) {
  const [busy, setBusy] = useState(false);

  const run = async (fn, successCb) => {
    setBusy(true);
    try {
      const res = await fn();
      if (successCb) successCb(res.data);
      if (onDone) onDone();
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    lock: () => run(api.lock),
    unlock: () => run(api.unlock),
    resetTrip: (onResetSuccess) => run(api.resetTrip, onResetSuccess),
    setPidConfig: (cfg) => run(() => api.setPidConfig(cfg)),
    setPidMode: (mode) => run(() => api.setPidMode(mode)),
  };
}