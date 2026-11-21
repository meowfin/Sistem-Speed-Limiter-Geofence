// Firmware mengukur RPM motor (optocoupler) dengan target RPM per zona, jadi gauge menampilkan RPM.
export default function SpeedGauge({ rpm = 0, target = 0, max = 300 }) {
  const frac = (v) => Math.min(Math.max(v / max, 0), 1);
  const pt = (f, r) => {
    const a = Math.PI * (1 - f);
    return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
  };
  const [x, y] = pt(frac(rpm), 80);
  const [tx1, ty1] = pt(frac(target), 68);
  const [tx2, ty2] = pt(frac(target), 94);
  const over = target > 0 && rpm > target * 1.1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Kecepatan motor</div>
      <svg viewBox="0 0 200 120" className="mx-auto w-full max-w-xs">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
        <path d={`M 20 100 A 80 80 0 0 1 ${x} ${y}`} fill="none" stroke={over ? '#dc2626' : '#2563eb'} strokeWidth="14" strokeLinecap="round" />
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#ea580c" strokeWidth="3" />
        <text x="100" y="88" textAnchor="middle" fontSize="28" fontWeight="700" fill="currentColor">{Math.round(rpm)}</text>
        <text x="100" y="106" textAnchor="middle" fontSize="10" fill="#64748b">RPM · target {target}</text>
      </svg>
    </div>
  );
}
