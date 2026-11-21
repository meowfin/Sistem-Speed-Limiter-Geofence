const STATES = {
  connected: ['Reverb terhubung', 'bg-green-100 text-green-700'],
  connecting: ['Menghubungkan…', 'bg-yellow-100 text-yellow-700'],
  unavailable: ['Reverb terputus', 'bg-red-100 text-red-700'],
  failed: ['Reverb gagal', 'bg-red-100 text-red-700'],
  disconnected: ['Reverb terputus', 'bg-red-100 text-red-700'],
};

export default function ConnectionBadge({ state, latest }) {
  const [text, cls] = STATES[state] || [`Reverb: ${state}`, 'bg-slate-200 text-slate-700'];
  const link = latest?.gsm ? 'GSM' : latest?.wifi ? 'WiFi' : null;

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`rounded-full px-3 py-1 ${cls}`}>{text}</span>
      {link && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">Perangkat via {link}</span>}
    </div>
  );
}
