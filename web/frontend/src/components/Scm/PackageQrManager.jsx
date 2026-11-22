import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';

export default function PackageQrManager({ onVerified }) {
  const [packages, setPackages] = useState([]);
  const [itemName, setItemName] = useState('');
  const [destination, setDestination] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);
  const scannerRef = useRef(null);

  const loadPackages = () => {
    api.getPackages().then((r) => setPackages(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadPackages();
    return () => stopScanner();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    await api.createPackage({ item_name: itemName, destination_name: destination });
    setItemName('');
    setDestination('');
    loadPackages();
  };

  const handlePrint = (pkg) => {
    const svgEl = document.getElementById(`qr-svg-${pkg.id}`);
    if (!svgEl) return;
    const svgHtml = svgEl.outerHTML;
    const win = window.open('', '_blank', 'width=400,height=450');
    win.document.write(`
      <html>
        <head><title>Label Paket ${pkg.package_code}</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:24px;">
          <div style="border:2px dashed #333;padding:16px;display:inline-block;border-radius:8px;">
            <h3 style="margin:0 0 8px 0;">SMART LOGISTICS SCM</h3>
            ${svgHtml}
            <p style="font-family:monospace;font-size:16px;font-weight:bold;margin:8px 0 4px;">${pkg.package_code}</p>
            <p style="margin:0;font-size:14px;">${pkg.item_name}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#555;">Tujuan: ${pkg.destination_name || '-'}</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const startScanner = async () => {
    setScanMsg(null);
    setScanning(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode('qr-reader-box');
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            await stopScanner();
            try {
              const res = await api.verifyPackageScan(decodedText);
              setScanMsg({ type: 'ok', text: res.data.message });
              loadPackages();
              if (onVerified) onVerified();
            } catch (err) {
              setScanMsg({
                type: 'err',
                text: err.response?.data?.message || 'Gagal memverifikasi QR Code.',
              });
            }
          },
          () => {},
        );
      } catch {
        setScanning(false);
        setScanMsg({
          type: 'err',
          text: 'Kamera gagal dibuka. Pastikan izin kamera aktif dan web dibuka melalui HTTPS (Cloudflare Tunnel).',
        });
      }
    }, 150);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">SCM QR Code & Verifikasi Paket Kontainer</h2>
          <p className="text-xs text-slate-500">Buat & cetak label QR untuk ditempel pada paket, lalu pindai via kamera HP saat tiba di tujuan.</p>
        </div>

        {!scanning ? (
          <button
            type="button"
            onClick={startScanner}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Scan QR via Kamera HP
          </button>
        ) : (
          <button
            type="button"
            onClick={stopScanner}
            className="rounded-lg bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Tutup Kamera
          </button>
        )}
      </div>

      {scanMsg && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            scanMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {scanMsg.text}
        </div>
      )}

      {scanning && (
        <div className="mb-4 overflow-hidden rounded-xl border border-indigo-200 bg-slate-900 p-3 text-center">
          <div id="qr-reader-box" className="mx-auto max-w-xs" />
          <p className="mt-2 text-xs text-slate-300">Arahkan kamera belakang HP ke label QR Code di dalam box kontainer</p>
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-4 grid gap-2 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Nama Barang (misal: Paket Obat Medis A)"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Tujuan Pengiriman (opsional)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Buat Label QR
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="qr-box shrink-0 shadow-sm">
                <QRCodeSVG
                    id={`qr-svg-${pkg.id}`}
                    value={pkg.package_code}
                    size={72}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    marginSize={1}
                />
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono font-bold text-slate-800">{pkg.package_code}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    pkg.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pkg.status === 'delivered' ? 'DITERIMA' : 'IN TRANSIT'}
                </span>
              </div>
              <p className="mt-1 truncate font-medium text-slate-700">{pkg.item_name}</p>
              <p className="truncate text-slate-500">{pkg.destination_name}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(pkg)}
                  className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100"
                >
                  Cetak Label
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await api.deletePackage(pkg.id);
                    loadPackages();
                  }}
                  className="text-slate-400 hover:text-rose-600"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
        {packages.length === 0 && (
          <p className="col-span-full text-sm text-slate-500">Belum ada label paket terdaftar.</p>
        )}
      </div>
    </div>
  );
}