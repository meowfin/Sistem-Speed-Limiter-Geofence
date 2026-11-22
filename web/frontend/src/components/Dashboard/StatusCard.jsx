const TONE = { ok: 'text-green-600', warn: 'text-orange-600', bad: 'text-red-600', neutral: 'text-slate-900' };

export default function StatusCard({ title, value, unit, tone = 'neutral' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${TONE[tone]}`}>
        {value ?? '-'}
        {unit && value != null && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}