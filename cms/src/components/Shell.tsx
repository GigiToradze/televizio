import { NavLink, Outlet } from 'react-router-dom';
import logo from '../assets/logo-red.png';
import TallyBar from './TallyBar';
import { useLang } from '../lang/LangProvider';
import { useChannels, usePlans } from '../lib/queries';
import { useSubscribers } from '../lib/subscribers';

export default function Shell() {
  const { t } = useLang();
  // All three are cached by the pages that use them, so reading counts here
  // costs nothing and turns the rail into a readout.
  const channels = useChannels();
  const plans = usePlans();
  const subscribers = useSubscribers();

  const groups = [
    {
      title: null,
      links: [
        { to: '/', label: t('მიმოხილვა', 'Overview'), end: true, count: undefined },
      ],
    },
    {
      title: t('შიგთავსი', 'Content'),
      links: [
        { to: '/channels', label: t('არხები', 'Channels'), count: channels.data?.length },
        { to: '/slider', label: t('სლაიდერი', 'Slider'),
          count: channels.data?.filter((c) => c.in_slider).length },
        { to: '/plans', label: t('პაკეტები', 'Plans'), count: plans.data?.length },
      ],
    },
    {
      title: t('აბონენტები', 'People'),
      links: [
        { to: '/subscribers', label: t('აბონენტები', 'Subscribers'),
          count: subscribers.data?.length },
      ],
    },
    {
      title: null,
      links: [
        { to: '/settings', label: t('პარამეტრები', 'Settings'), count: undefined },
      ],
    },
  ];

  return (
    <div className="app">
      <div className="brand">
        <img className="brand__logo" src={logo} alt="Televizio" width={900} height={268} />
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
             rel="noreferrer">{t('საიტის ნახვა ↗', 'View site ↗')}</a>
        </div>
      </nav>

      <main className="stage"><Outlet /></main>
    </div>
  );
}
