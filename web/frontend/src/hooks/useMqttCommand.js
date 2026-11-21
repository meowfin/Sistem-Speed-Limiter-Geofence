import { useState } from 'react';
import api from '../services/api';

// Kirim LOCK / UNLOCK: dashboard → POST /api/command/* → Laravel → MQTT → ESP32
export default function useMqttCommand(onDone) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  const send = async (cmd) => {
    setSending(true);
    setMessage(null);
    try {
      await (cmd === 'LOCK' ? api.lock() : api.unlock());
      setMessage({ ok: true, text: `Perintah ${cmd} terkirim ke perangkat.` });
      onDone?.();
    } catch (e) {
      setMessage({ ok: false, text: e.response?.data?.message || 'Gagal mengirim perintah.' });
    } finally {
      setSending(false);
    }
  };

  return { send, sending, message };
}
