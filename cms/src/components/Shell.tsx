import { NavLink, Outlet } from 'react-router-dom';
import TallyBar from './TallyBar';
import { useChannels, usePlans } from '../lib/queries';
import { useSubscribers } from '../lib/subscribers';

export default function Shell() {
  // All three are cached by the pages that use them, so reading counts here
  // costs nothing and turns the rail into a readout.
  const channels = useChannels();
  const plans = usePlans();
  const subscribers = useSubscribers();

  const groups = [
    {
      title: null,
      links: [{ to: '/', label: 'Overview', end: true, count: undefined }],
    },
    {
      title: 'Content',
      links: [
        { to: '/channels', label: 'Channels', count: channels.data?.length },
        { to: '/slider', label: 'Slider',
          count: channels.data?.filter((c) => c.in_slider).length },
        { to: '/plans', label: 'Plans', count: plans.data?.length },
      ],
    },
    {
      title: 'People',
      links: [
        { to: '/subscribers', label: 'Subscribers', count: subscribers.data?.length },
      ],
    },
    {
      title: null,
      links: [{ to: '/settings', label: 'Settings', count: undefined }],
    },
  ];

  return (
    <div className="app">
      <div className="brand">
        <span className="brand__star" aria-hidden="true" />
        <span className="brand__name">Televizio</span>
      </div>

      <TallyBar />

      <nav className="rail">
        {groups.map((g, i) => (
          <div key={g.title ?? `g${i}`}>
            {g.title && <p className="rail__group eyebrow">{g.title}</p>}
            {g.links.map((l) => (
              <NavLink
                key={l.to} to={l.to} end={'end' in l ? l.end : false}
                className={({ isActive }) => `rail__link${isActive ? ' is-on' : ''}`}
              >
                {l.label}
                {l.count !== undefined && <span className="rail__count">{l.count}</span>}
              </NavLink>
            ))}
          </div>
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
