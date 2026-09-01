import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Shell from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Channels from './pages/Channels';
import Slider from './pages/Slider';
import Plans from './pages/Plans';
import Settings from './pages/Settings';
import Subscribers from './pages/Subscribers';
import Subscriber from './pages/Subscriber';

const qc = new QueryClient();

/** The mirror of Private. Without it a successful sign-in leaves the browser
 *  sitting on /login looking at the form it just submitted, which reads as the
 *  button having done nothing at all. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="gate"><p className="eyebrow">Loading</p></div>;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Private() {
  const { session, admin, loading, signOut } = useAuth();
  if (loading) return <div className="gate"><p className="eyebrow">Loading</p></div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!admin) {
    return (
      <div className="gate">
        <div className="gate__form">
          <p className="eyebrow">No access</p>
          <p>This account is signed in but is not an admin.</p>
          <p className="note">Ask an owner to add you from Settings.</p>
          <button className="btn btn--sm" onClick={signOut}>Sign out</button>
        </div>
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
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route element={<Private />}>
              <Route index element={<Overview />} />
              <Route path="channels" element={<Channels />} />
              <Route path="slider" element={<Slider />} />
              <Route path="plans" element={<Plans />} />
              <Route path="subscribers" element={<Subscribers />} />
              <Route path="subscribers/:id" element={<Subscriber />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
