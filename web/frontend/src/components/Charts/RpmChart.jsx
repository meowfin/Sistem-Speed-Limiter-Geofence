import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatTime } from '../../utils/formatDate';
import { targetRpm } from '../../utils/geofenceUtils';

export default function RpmChart({ data }) {
  const rows = data.map((d) => ({ t: formatTime(d.recorded_at), rpm: d.rpm, target: targetRpm(d.in_zone) }));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">RPM aktual vs target</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="rpm" name="RPM aktual" stroke="#2563eb" dot={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="target" name="Target RPM" stroke="#ea580c" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
