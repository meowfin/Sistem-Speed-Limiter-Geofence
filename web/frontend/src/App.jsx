import useTelemetry from './hooks/useTelemetry';
import useMqttCommand from './hooks/useMqttCommand';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const t = useTelemetry();
  const cmd = useMqttCommand(t.refreshActivities);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar connection={t.connection} latest={t.latest} />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <DashboardPage t={t} cmd={cmd} />
        </main>
      </div>
    </div>
  );
}
