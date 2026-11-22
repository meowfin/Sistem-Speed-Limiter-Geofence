import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatTime } from '../../utils/formatDate';
import { targetRpm } from '../../utils/geofenceUtils';

export default function RpmChart({ data }) {
  const rows = data.map((d) => ({
    t: formatTime(d.recorded_at),
    rpm: d.rpm ?? 0,
    target: d.setpoint_rpm ?? targetRpm(d.in_zone),
    pwm: d.pwm_out ?? '-',
    error: d.pid_error ?? '-',
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Respons Kontrol PID: RPM Aktual vs Setpoint
        </span>
        {data.length > 0 && (
          <span className="rounded border border-blue-500/30 bg-blue-950/60 px-2 py-0.5 text-xs font-semibold text-sky-400">
            Mode: {data[data.length - 1]?.pid_mode || 'AUTO'} | PWM: {data[data.length - 1]?.pwm_out ?? '-'}
        </span>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" fontSize={11} />
            <YAxis fontSize={11} domain={[0, 230]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="rpm" name="RPM Aktual" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="target" name="Setpoint RPM" stroke="#fb923c" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}