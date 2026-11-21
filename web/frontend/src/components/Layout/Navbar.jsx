import ConnectionBadge from '../Dashboard/ConnectionBadge';

export default function Navbar({ connection, latest }) {
  return (
    <header className="sticky top-0 z-[1100] flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <h1 className="text-lg font-bold">Speed Limiter Geofence</h1>
        <p className="text-xs text-slate-500">Dashboard monitoring · {latest?.vehicle_id || 'TRUCK-01'}</p>
      </div>
      <ConnectionBadge state={connection} latest={latest} />
    </header>
  );
}
