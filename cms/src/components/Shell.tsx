import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/channels', label: 'Channels' },
  { to: '/slider', label: 'Slider' },
  { to: '/plans', label: 'Plans' },
  { to: '/settings', label: 'Settings' },
];

export default function Shell() {
  const { admin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-6 border-b border-neutral-800 px-6 py-3">
        <span className="font-semibold tracking-tight">Televizio CMS</span>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((l) => (
            <NavLink
              key={l.to} to={l.to} end={l.end}
              className={({ isActive }) =>
                isActive ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-100'}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm text-neutral-400">
          <span>{admin?.name} · {admin?.role}</span>
          <button onClick={signOut} className="hover:text-neutral-100">Sign out</button>
        </div>
      </header>
      <main className="p-6"><Outlet /></main>
    </div>
  );
}
