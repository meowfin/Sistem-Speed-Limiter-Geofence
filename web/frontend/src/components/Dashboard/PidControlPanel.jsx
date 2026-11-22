import { useEffect, useState } from 'react';

const WHEEL_CIRCUMFERENCE_M = Math.PI * 0.065; // Keliling roda 6.5 cm (0.2042 m)

// Fungsi konversi antar satuan
const rpmToMps = (rpm) => (rpm * WHEEL_CIRCUMFERENCE_M) / 60;
const rpmToKmh = (rpm) => rpmToMps(rpm) * 3.6;
const mpsToRpm = (mps) => (mps * 60) / WHEEL_CIRCUMFERENCE_M;
const kmhToRpm = (kmh) => mpsToRpm(kmh / 3.6);

export default function PidControlPanel({ latest, cmd, onSessionReset, activeSession }) {
  const [kp, setKp] = useState(1.1);
  const [ki, setKi] = useState(0.45);
  const [kd, setKd] = useState(0.05);

  const [unit, setUnit] = useState('RPM'); // 'RPM' | 'KMH' | 'MPS'
  const [targetInput, setTargetInput] = useState(145);

  useEffect(() => {
    if (latest?.kp != null) setKp(latest.kp);
    if (latest?.ki != null) setKi(latest.ki);
    if (latest?.kd != null) setKd(latest.kd);
  }, [latest?.kp, latest?.ki, latest?.kd]);

  // Ganti satuan dan otomatis konversi nilai yang sedang tampil di input box
  const handleUnitChange = (newUnit) => {
    let currentRpmVal = Number(targetInput) || 0;
    if (unit === 'KMH') currentRpmVal = kmhToRpm(currentRpmVal);
    if (unit === 'MPS') currentRpmVal = mpsToRpm(currentRpmVal);

    setUnit(newUnit);
    if (newUnit === 'RPM') setTargetInput(Math.round(currentRpmVal));
    if (newUnit === 'KMH') setTargetInput(Number(rpmToKmh(currentRpmVal).toFixed(2)));
    if (newUnit === 'MPS') setTargetInput(Number(rpmToMps(currentRpmVal).toFixed(2)));
  };

  // Hitung Setpoint RPM final yang akan dikirim ke ESP32
  const getComputedSetpointRpm = () => {
    const val = Number(targetInput) || 0;
    if (unit === 'KMH') return kmhToRpm(val);
    if (unit === 'MPS') return mpsToRpm(val);
    return val;
  };

  const computedRpm = getComputedSetpointRpm();
  const currentMode = latest?.pid_mode || 'AUTO';

  const handleSavePid = (e) => {
    e.preventDefault();
    cmd.setPidConfig({
      kp: parseFloat(kp),
      ki: parseFloat(ki),
      kd: parseFloat(kd),
      setpoint_rpm: Math.round(computedRpm * 10) / 10,
    });
  };

  const handleReset = () => {
    if (!window.confirm('Reset seluruh data perjalanan aktif, kosongkan grafik/peta, dan kunci kembali box kontainer?')) {
      return;
    }
    cmd.resetTrip((res) => {
      if (onSessionReset) onSessionReset(res?.new_session || '');
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">Kontrol Otomatis PID & Manajemen Sesi</h3>
          <p className="text-xs text-slate-500">
            Sesi Aktif: <span className="font-mono font-medium text-slate-700">{activeSession || '-'}</span> | Error:{' '}
            <b>{latest?.pid_error ?? 0} RPM</b> | PWM Out: <b>{latest?.pwm_out ?? '-'}</b>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={cmd.busy}
            onClick={() => cmd.setPidMode(currentMode === 'AUTO' ? 'MANUAL' : 'AUTO')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
              currentMode === 'AUTO' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            Mode: {currentMode === 'AUTO' ? 'AUTO (Closed-Loop PID)' : 'MANUAL (Open-Loop)'}
          </button>

          <button
            type="button"
            disabled={cmd.busy}
            onClick={handleReset}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Reset Perjalanan
          </button>
        </div>
      </div>

      <form onSubmit={handleSavePid} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div>
          <label className="block text-xs font-medium text-slate-600">Kp (Proporsional)</label>
          <input
            type="number"
            step="0.01"
            value={kp}
            onChange={(e) => setKp(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Ki (Integral)</label>
          <input
            type="number"
            step="0.01"
            value={ki}
            onChange={(e) => setKi(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Kd (Derivatif)</label>
          <input
            type="number"
            step="0.01"
            value={kd}
            onChange={(e) => setKd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>

        {/* Input Setpoint Multi-Satuan (RPM / km/jam / m/s) */}
        <div className="col-span-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-600">Target Kecepatan (Setpoint)</label>
            <span className="text-[11px] font-medium text-blue-600">
              {unit === 'RPM'
                ? `≈ ${rpmToKmh(computedRpm).toFixed(2)} km/j | ${rpmToMps(computedRpm).toFixed(2)} m/s`
                : `Kirim ke ESP32: ${Math.round(computedRpm)} RPM`}
            </span>
          </div>
          <div className="mt-1 flex rounded-lg shadow-xs">
            <input
              type="number"
              step={unit === 'RPM' ? '1' : '0.01'}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full rounded-l-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none"
            />
            <select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value)}
              className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="RPM">RPM</option>
              <option value="KMH">km/jam</option>
              <option value="MPS">m/s</option>
            </select>
          </div>
        </div>

        <div className="col-span-2 flex items-end sm:col-span-1">
          <button
            type="submit"
            disabled={cmd.busy}
            className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Terapkan
          </button>
        </div>
      </form>
    </div>
  );
}