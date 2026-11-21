import SpeedGauge from '../components/Dashboard/SpeedGauge';
import StatusCard from '../components/Dashboard/StatusCard';
import ControlPanel from '../components/Dashboard/ControlPanel';
import MapView from '../components/Map/MapView';
import RpmChart from '../components/Charts/RpmChart';
import TempHumChart from '../components/Charts/TempHumChart';
import formatDate from '../utils/formatDate';
import { haversine, hasFix, targetRpm } from '../utils/geofenceUtils';

const num = (v, d = 1) => (v == null ? null : Number(v).toFixed(d));

export default function DashboardPage({ t, cmd }) {
  const L = t.latest;
  const dist = L && Number(L.distance) >= 0 ? num(L.distance) : null;
  const geoDist = t.geofences.map((g) => ({
    id: g.id,
    name: g.name,
    m: hasFix(L) ? haversine(Number(L.latitude), Number(L.longitude), Number(g.center_lat), Number(g.center_lng)) : null,
    r: g.radius_meters,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {t.error && <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">{t.error}</div>}
      {!L && !t.error && (
        <div className="rounded-lg bg-yellow-100 p-3 text-sm text-yellow-800">
          Menunggu data dari perangkat. Pastikan <code>php artisan mqtt:listen</code> berjalan dan ESP32/Wokwi menyala.
        </div>
      )}

      <section id="ringkasan" className="grid scroll-mt-20 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2"><SpeedGauge rpm={L?.rpm ?? 0} target={targetRpm(L?.in_zone)} /></div>
        <StatusCard title="Zona" value={L ? (L.in_zone ? 'Zona lambat' : 'Zona bebas') : null} tone={L?.in_zone ? 'warn' : 'ok'} hint={L?.in_zone ? 'Target RPM 100' : 'Target RPM 255'} />
        <StatusCard title="Tujuan" value={L ? (L.arrived ? 'Sudah tiba' : 'Dalam perjalanan') : null} tone={L?.arrived ? 'ok' : 'neutral'} hint={dist ? `Jarak ${dist} m` : 'Jarak belum tersedia'} />
        <StatusCard title="Baterai" value={num(L?.battery, 0)} unit="%" tone={L && L.battery < 20 ? 'bad' : 'neutral'} hint="Nilai simulasi dari firmware" />
        <StatusCard title="Suhu" value={num(L?.temperature)} unit="°C" />
        <StatusCard title="Kelembapan" value={num(L?.humidity)} unit="%" />
        <StatusCard title="Update terakhir" value={L ? formatDate(L.recorded_at) : null} />
        <ControlPanel latest={L} cmd={cmd} />
      </section>

      <section id="peta" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Peta geofence</h2>
        <MapView latest={L} geofences={t.geofences} trail={t.history} />
        <ul className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          {geoDist.map((g) => (
            <li key={g.id}>{g.name}: <b>{g.m == null ? '-' : `${Math.round(g.m)} m`}</b> dari pusat (radius {g.r} m)</li>
          ))}
        </ul>
      </section>

      <section id="grafik" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <RpmChart data={t.history} />
        <TempHumChart data={t.history} />
      </section>

      <section id="aktivitas" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Riwayat aktivitas</h2>
        {t.activities.length === 0 && <p className="text-sm text-slate-500">Belum ada aktivitas.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {t.activities.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{a.action}</span>
              <span className="flex-1">{a.message}</span>
              <span className="text-xs text-slate-500">{formatDate(a.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
