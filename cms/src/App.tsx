import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Shell from './components/Shell';
import Login from './pages/Login';
import Channels from './pages/Channels';
import Slider from './pages/Slider';
import Plans from './pages/Plans';
import Settings from './pages/Settings';

const qc = new QueryClient();

function Private() {
  const { session, admin, loading } = useAuth();
  if (loading) return <div className="p-6 text-neutral-500">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!admin) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-400">
        This account is not an admin. Ask an owner to add you.
      </div>
    );
  }
  return <Shell />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Private />}>
              <Route index element={<div>Dashboard comes in Plan 4.</div>} />
              <Route path="channels" element={<Channels />} />
              <Route path="slider" element={<Slider />} />
              <Route path="plans" element={<Plans />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
