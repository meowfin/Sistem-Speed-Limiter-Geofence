import { useState } from 'react';
import api from '../services/api';

export default function useMqttCommand(onSuccess) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  const send = async (command) => {
    setSending(true);
    setMessage(null);
    try {
      const cmdUpper = String(command).toUpperCase();
      let res;

      if (cmdUpper === 'LOCK') {
        res = await api.lock();
      } else if (cmdUpper === 'UNLOCK') {
        res = await api.unlock();
      } else if (cmdUpper === 'RESET') {
        res = await api.resetTrip();
      } else {
        throw new Error(`Perintah tidak dikenal: ${command}`);
      }

      setMessage({
        ok: true,
        text: res.data?.message || `Perintah ${cmdUpper} berhasil dikirim`,
      });

      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      setMessage({
        ok: false,
        text: err.response?.data?.message || err.message || 'Gagal mengirim perintah',
      });
    } finally {
      setSending(false);
    }
  };

  const setPidConfig = async (payload) => {
    setSending(true);
    setMessage(null);
    try {
      const res = await api.setPidConfig(payload);
      setMessage({
        ok: true,
        text: res.data?.message || 'Konfigurasi PID berhasil diterapkan',
      });
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      setMessage({
        ok: false,
        text: err.response?.data?.message || err.message || 'Gagal menerapkan PID',
      });
    } finally {
      setSending(false);
    }
  };

  const setPidMode = async (mode) => {
    setSending(true);
    setMessage(null);
    try {
      const res = await api.setPidMode(mode);
      setMessage({
        ok: true,
        text: res.data?.message || `Mode PID diubah ke ${mode}`,
      });
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      setMessage({
        ok: false,
        text: err.response?.data?.message || err.message || 'Gagal mengubah mode PID',
      });
    } finally {
      setSending(false);
    }
  };

  return { sending, message, send, setPidConfig, setPidMode };
}