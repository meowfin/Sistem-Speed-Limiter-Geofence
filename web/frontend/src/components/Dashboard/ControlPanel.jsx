export default function ControlPanel({ latest, cmd }) {
  const lock = latest?.lock;
  const arrived = !!latest?.arrived;
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Kontrol box kargo</div>
      <div className="mt-1 text-sm">
        Status:{' '}
        <b className={lock === 'LOCKED' ? 'text-green-600' : 'text-orange-600'}>{lock || '-'}</b>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={cmd.sending} onClick={() => cmd.send('LOCK')} className={`${btn} bg-slate-800`}>Kunci</button>
        <button disabled={cmd.sending || !arrived} onClick={() => cmd.send('UNLOCK')} className={`${btn} bg-blue-600`}>Buka</button>
      </div>
      {!arrived && (
        <p className="mt-2 text-xs text-slate-500">
          Buka hanya bisa setelah kendaraan tiba di tujuan (radius 20 m). Firmware menolak UNLOCK sebelum itu.
        </p>
      )}
      {cmd.message && (
        <p className={`mt-2 text-xs ${cmd.message.ok ? 'text-green-600' : 'text-red-600'}`}>{cmd.message.text}</p>
      )}
    </div>
  );
}
