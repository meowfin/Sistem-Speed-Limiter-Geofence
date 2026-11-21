import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatTime } from '../../utils/formatDate';

export default function TempHumChart({ data }) {
  const rows = data.map((d) => ({ t: formatTime(d.recorded_at), temp: d.temperature, hum: d.humidity }));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Suhu dan kelembapan (DHT22)</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="temp" name="Suhu (°C)" stroke="#dc2626" dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="hum" name="Kelembapan (%)" stroke="#0891b2" dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
