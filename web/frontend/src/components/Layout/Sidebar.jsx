const LINKS = [
  ['#ringkasan', 'Ringkasan'],
  ['#peta', 'Peta Geofence'],
  ['#grafik', 'Grafik'],
  ['#aktivitas', 'Riwayat aktivitas'],
];

export default function Sidebar() {
  return (
    <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-52 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
      <nav className="flex flex-col gap-1 text-sm">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">
            {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
