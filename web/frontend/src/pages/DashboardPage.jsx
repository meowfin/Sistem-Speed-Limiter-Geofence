import SpeedGauge from '../components/Dashboard/SpeedGauge';
import StatusCard from '../components/Dashboard/StatusCard';
import ControlPanel from '../components/Dashboard/ControlPanel';
import PidControlPanel from '../components/Dashboard/PidControlPanel';
import MapView from '../components/Map/MapView';
import RpmChart from '../components/Charts/RpmChart';
import TempHumChart from '../components/Charts/TempHumChart';
import PackageQrManager from '../components/Scm/PackageQrManager';
import TripHistoryTable from '../components/Logs/TripHistoryTable';
import formatDate from '../utils/formatDate';
import { haversine, hasFix, targetRpm } from '../utils/geofenceUtils';

const num = (v, d = 1) => (v == null ? null : Number(v).toFixed(d));

// Fallback perhitungan kecepatan di frontend (roda 6.5 cm) jika field speed_kmh belum terisi
const calcSpeedKmh = (L) => {
  if (!L) return null;
  if (L.speed_kmh != null) return Number(L.speed_kmh).toFixed(2);
  const rpm = Number(L.rpm ?? 0);
  return (((rpm * Math.PI * 0.065) / 60) * 3.6).toFixed(2);
};

const calcSpeedMps = (L) => {
  if (!L) return null;
  if (L.speed_mps != null) return Number(L.speed_mps).toFixed(2);
  const rpm = Number(L.rpm ?? 0);
  return ((rpm * Math.PI * 0.065) / 60).toFixed(2);
};

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
      {t.error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-sm text-rose-300">
          {t.error}
        </div>
      )}
      {!L && !t.error && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 p-3 text-sm text-sky-300">
          Menunggu data dari perangkat. Pastikan <code className="rounded bg-slate-900 px-1.5 py-0.5 text-sky-400">php artisan mqtt:listen</code> berjalan dan ESP32 menyala.
        </div>
      )}

      <section id="ringkasan" className="grid scroll-mt-20 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <SpeedGauge rpm={L?.rpm ?? 0} target={L?.setpoint_rpm ?? targetRpm(L?.in_zone)} />
        </div>
        <StatusCard
          title="Kecepatan (km/jam)"
          value={calcSpeedKmh(L)}
          unit="km/j"
          tone="ok"
        />
        <StatusCard
          title="Kecepatan (m/s)"
          value={calcSpeedMps(L)}
          unit="m/s"
          tone="ok"
        />
        <StatusCard
          title="Zona"
          value={
            L
              ? L.in_zone
                ? 'Zona sekolah'
                : L.in_toll
                  ? 'Zona tol'
                  : 'Zona bebas'
              : null
          }
          tone={L?.in_zone ? 'warn' : L?.in_toll ? 'bad' : 'ok'}
        />
        <StatusCard
          title="Tujuan"
          value={L ? (L.arrived ? 'Sudah tiba' : 'Dalam perjalanan') : null}
          tone={L?.arrived ? 'ok' : 'neutral'}
        />
        <StatusCard title="Suhu" value={num(L?.temperature)} unit="°C" />
        <StatusCard title="Kelembapan" value={num(L?.humidity)} unit="%" />
        <ControlPanel latest={L} cmd={cmd} />
      </section>

      <section id="pid-control" className="scroll-mt-20">
        <PidControlPanel
          latest={L}
          cmd={cmd}
          activeSession={t.activeSession}
          onSessionReset={(newSess) => t.clearSessionState(newSess)}
        />
      </section>

      <section id="grafik" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <RpmChart data={t.history} />
        <TempHumChart data={t.history} />
      </section>

      <section id="peta" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Peta Geofence</h2>
        <MapView latest={L} geofences={t.geofences} trail={t.history} />
        <ul className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          {geoDist.map((g) => (
            <li key={g.id}>{g.name}: <b>{g.m == null ? '-' : `${Math.round(g.m)} m`}</b> dari pusat (radius {g.r} m)</li>
          ))}
        </ul>
      </section>

      <section id="scm-qr" className="scroll-mt-20">
        <PackageQrManager onVerified={t.refreshActivities} />
      </section>

      <section id="riwayat-csv" className="scroll-mt-20">
        <TripHistoryTable refreshTrigger={t.activeSession} />
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