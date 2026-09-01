import { NavLink, Outlet } from 'react-router-dom';
import TallyBar from './TallyBar';
import { useChannels, usePlans } from '../lib/queries';

export default function Shell() {
  // Both are already cached by the pages that use them, so reading the
  // counts here costs nothing and turns the rail into a readout.
  const channels = useChannels();
  const plans = usePlans();

  const links = [
    { to: '/', label: 'Overview', end: true, count: undefined },
    { to: '/channels', label: 'Channels', count: channels.data?.length },
    { to: '/slider', label: 'Slider',
      count: channels.data?.filter((c) => c.in_slider).length },
    { to: '/plans', label: 'Plans', count: plans.data?.length },
    { to: '/settings', label: 'Settings', count: undefined },
  ];

  return (
    <div className="app">
      <div className="brand">
        <span className="brand__star" aria-hidden="true" />
        <span className="brand__name">Televizio</span>
      </div>

      <TallyBar />

      <nav className="rail">
        <p className="rail__group eyebrow">Content</p>
        {links.map((l) => (
          <NavLink
            key={l.to} to={l.to} end={l.end}
            className={({ isActive }) => `rail__link${isActive ? ' is-on' : ''}`}
          >
            {l.label}
            {l.count !== undefined && <span className="rail__count">{l.count}</span>}
          </NavLink>
        ))}
        <div className="rail__foot">
          <a className="eyebrow" href="https://televizio.ge" target="_blank"
             rel="noreferrer">View site ↗</a>
        </div>
      </nav>

      <main className="stage"><Outlet /></main>
    </div>
  );
}
